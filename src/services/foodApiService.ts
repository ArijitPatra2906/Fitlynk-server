import axios from 'axios';

interface NutrientData {
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

interface FoodSearchResult {
  name: string;
  brand?: string;
  barcode?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  source: 'usda' | 'open_food_facts';
}

class FoodApiService {
  private usdaApiKey: string;
  private usdaBaseUrl = 'https://api.nal.usda.gov/fdc/v1';
  private openFoodFactsBaseUrl = 'https://world.openfoodfacts.org/cgi';

  constructor() {
    this.usdaApiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
  }

  /**
   * Search for foods using USDA FoodData Central API
   */
  async searchUSDA(query: string, limit: number = 10): Promise<FoodSearchResult[]> {
    try {
      const response = await axios.get(`${this.usdaBaseUrl}/foods/search`, {
        params: {
          api_key: this.usdaApiKey,
          query: query,
          pageSize: limit,
        },
        timeout: 10000,
      });

      if (!response.data?.foods) {
        return [];
      }

      return response.data.foods.map((food: any) => {
        const nutrients = this.extractUSDANutrients(food);

        return {
          name: food.description || food.lowercaseDescription || 'Unknown Food',
          brand: food.brandOwner || food.brandName,
          barcode: food.gtinUpc,
          ...nutrients,
          source: 'usda' as const,
        };
      }).filter((food: FoodSearchResult) =>
        // Filter out items with zero nutrition (likely errors)
        food.calories_per_100g > 0 || food.protein_per_100g > 0
      );
    } catch (error: any) {
      // Log meaningful error messages only
      if (error.response?.status === 429) {
        console.warn('USDA API rate limit exceeded - using local database only');
      } else if (error.code !== 'ECONNABORTED') {
        console.error('USDA API error:', error.message || error);
      }
      return [];
    }
  }

  /**
   * Search for foods using Open Food Facts API
   */
  async searchOpenFoodFacts(query: string, limit: number = 10): Promise<FoodSearchResult[]> {
    try {
      const response = await axios.get(`${this.openFoodFactsBaseUrl}/search.pl`, {
        params: {
          search_terms: query,
          page_size: limit,
          json: 1,
          fields: 'product_name,brands,code,nutriments',
        },
        headers: {
          'User-Agent': 'Fitlynk - Nutrition Tracker - v1.0',
        },
        timeout: 10000,
      });

      if (!response.data?.products) {
        return [];
      }

      return response.data.products.map((product: any) => {
        const nutrients = this.extractOpenFoodFactsNutrients(product);

        return {
          name: product.product_name || 'Unknown Product',
          brand: product.brands,
          barcode: product.code,
          ...nutrients,
          source: 'open_food_facts' as const,
        };
      }).filter((food: FoodSearchResult) =>
        // Filter out items with zero nutrition
        food.calories_per_100g > 0 || food.protein_per_100g > 0
      );
    } catch (error: any) {
      // Only log non-timeout errors (timeouts are expected and handled gracefully)
      if (error.code !== 'ECONNABORTED') {
        console.error('Open Food Facts API error:', error.message);
      }
      return [];
    }
  }

  /**
   * Search both APIs and combine results
   */
  async searchAll(query: string, limit: number = 20): Promise<FoodSearchResult[]> {
    try {
      // Start with USDA (more reliable), make OFF optional
      const usdaPromise = this.searchUSDA(query, limit);

      // Only wait 3 seconds for Open Food Facts, then proceed with USDA only
      const offPromise = Promise.race([
        this.searchOpenFoodFacts(query, Math.ceil(limit / 3)),
        new Promise<FoodSearchResult[]>((resolve) => setTimeout(() => resolve([]), 3000))
      ]);

      const [usdaResults, offResults] = await Promise.allSettled([
        usdaPromise,
        offPromise,
      ]);

      const allResults: FoodSearchResult[] = [];

      if (usdaResults.status === 'fulfilled') {
        allResults.push(...usdaResults.value);
      }

      if (offResults.status === 'fulfilled') {
        allResults.push(...offResults.value);
      }

      // Sort by relevance (foods with complete nutrition data first)
      return allResults
        .sort((a, b) => {
          const aComplete = (a.calories_per_100g > 0 ? 1 : 0) +
                          (a.protein_per_100g > 0 ? 1 : 0) +
                          (a.carbs_per_100g > 0 ? 1 : 0) +
                          (a.fat_per_100g > 0 ? 1 : 0);
          const bComplete = (b.calories_per_100g > 0 ? 1 : 0) +
                          (b.protein_per_100g > 0 ? 1 : 0) +
                          (b.carbs_per_100g > 0 ? 1 : 0) +
                          (b.fat_per_100g > 0 ? 1 : 0);
          return bComplete - aComplete;
        })
        .slice(0, limit);
    } catch (error) {
      console.error('Food API search error:', error);
      return [];
    }
  }

  /**
   * Get food by barcode from Open Food Facts
   */
  async getFoodByBarcode(barcode: string): Promise<FoodSearchResult | null> {
    try {
      const response = await axios.get(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        {
          headers: {
            'User-Agent': 'Fitlynk - Nutrition Tracker - v1.0',
          },
          timeout: 10000,
        }
      );

      if (!response.data?.product) {
        return null;
      }

      const product = response.data.product;
      const nutrients = this.extractOpenFoodFactsNutrients(product);

      return {
        name: product.product_name || 'Unknown Product',
        brand: product.brands,
        barcode: product.code,
        ...nutrients,
        source: 'open_food_facts',
      };
    } catch (error) {
      console.error('Barcode lookup error:', error);
      return null;
    }
  }

  /**
   * Extract and normalize nutrients from USDA data
   */
  private extractUSDANutrients(food: any): NutrientData {
    const nutrients: any = {};

    if (food.foodNutrients) {
      food.foodNutrients.forEach((nutrient: any) => {
        const nutrientId = nutrient.nutrientId;
        const value = nutrient.value || 0;

        // Map USDA nutrient IDs to our format
        switch (nutrientId) {
          case 1008: // Energy (kcal)
            nutrients.calories = value;
            break;
          case 1003: // Protein
            nutrients.protein = value;
            break;
          case 1005: // Carbohydrates
            nutrients.carbs = value;
            break;
          case 1004: // Total lipid (fat)
            nutrients.fat = value;
            break;
        }
      });
    }

    // Convert to per 100g if needed
    const servingSize = food.servingSize || 100;
    const multiplier = 100 / servingSize;

    return {
      calories_per_100g: Math.round((nutrients.calories || 0) * multiplier),
      protein_per_100g: Math.round((nutrients.protein || 0) * multiplier * 10) / 10,
      carbs_per_100g: Math.round((nutrients.carbs || 0) * multiplier * 10) / 10,
      fat_per_100g: Math.round((nutrients.fat || 0) * multiplier * 10) / 10,
    };
  }

  /**
   * Extract and normalize nutrients from Open Food Facts data
   */
  private extractOpenFoodFactsNutrients(product: any): NutrientData {
    const nutriments = product.nutriments || {};

    return {
      calories_per_100g: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
      protein_per_100g: Math.round((nutriments.proteins_100g || nutriments.proteins || 0) * 10) / 10,
      carbs_per_100g: Math.round((nutriments.carbohydrates_100g || nutriments.carbohydrates || 0) * 10) / 10,
      fat_per_100g: Math.round((nutriments.fat_100g || nutriments.fat || 0) * 10) / 10,
    };
  }
}

export default new FoodApiService();
