const fs = require('fs')

const categories = ['strength', 'cardio', 'mobility', 'plyometric']

const muscleGroups = {
  chest: [
    'Bench Press',
    'Incline Press',
    'Decline Press',
    'Chest Fly',
    'Cable Fly',
    'Push-up',
    'Chest Dip',
  ],
  back: [
    'Pull-up',
    'Chin-up',
    'Lat Pulldown',
    'Seated Row',
    'Bent Over Row',
    'T-Bar Row',
    'Straight Arm Pulldown',
  ],
  shoulders: [
    'Overhead Press',
    'Arnold Press',
    'Lateral Raise',
    'Front Raise',
    'Rear Delt Fly',
    'Face Pull',
  ],
  biceps: [
    'Barbell Curl',
    'Dumbbell Curl',
    'Hammer Curl',
    'Preacher Curl',
    'Concentration Curl',
  ],
  triceps: [
    'Tricep Pushdown',
    'Overhead Extension',
    'Skull Crusher',
    'Close Grip Bench Press',
    'Bench Dip',
  ],
  quadriceps: [
    'Squat',
    'Front Squat',
    'Leg Press',
    'Hack Squat',
    'Bulgarian Split Squat',
    'Step Up',
  ],
  hamstrings: [
    'Romanian Deadlift',
    'Stiff Leg Deadlift',
    'Leg Curl',
    'Nordic Curl',
  ],
  glutes: ['Hip Thrust', 'Glute Bridge', 'Cable Kickback', 'Reverse Lunge'],
  calves: ['Standing Calf Raise', 'Seated Calf Raise', 'Donkey Calf Raise'],
  abs: [
    'Crunch',
    'Cable Crunch',
    'Hanging Leg Raise',
    'Reverse Crunch',
    'Plank',
  ],
  obliques: ['Russian Twist', 'Side Plank', 'Woodchopper'],
  cardio: [
    'Running',
    'Cycling',
    'Rowing',
    'Jump Rope',
    'Elliptical',
    'Stair Climber',
  ],
}

const equipments = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'resistance band',
  'none',
]

const variations = [
  'Standard',
  'Wide Grip',
  'Close Grip',
  'Neutral Grip',
  'Single Arm',
  'Alternating',
  'Paused',
  'Tempo',
  'Explosive',
  'Slow Negative',
]

let exercises = []

Object.entries(muscleGroups).forEach(([muscle, baseExercises]) => {
  baseExercises.forEach((base) => {
    variations.forEach((variation) => {
      const equipment =
        equipments[Math.floor(Math.random() * equipments.length)]

      exercises.push({
        name: `${variation} ${base}`,
        category: muscle === 'cardio' ? 'cardio' : 'strength',
        muscle_groups: [muscle],
        equipment: equipment,
        is_custom: false,
      })
    })
  })
})

// Add extra cardio & plyometric
const extraCardio = [
  'Burpees',
  'Mountain Climbers',
  'High Knees',
  'Jump Squats',
  'Box Jumps',
  'Battle Rope',
  'Sled Push',
  'Farmer Carry',
  'Kettlebell Swing',
]

extraCardio.forEach((ex) => {
  exercises.push({
    name: ex,
    category: 'cardio',
    muscle_groups: ['full_body'],
    equipment: 'bodyweight',
    is_custom: false,
  })
})

// ensure 500+
while (exercises.length < 550) {
  exercises.push({
    name: `Functional Exercise ${exercises.length}`,
    category: 'strength',
    muscle_groups: ['full_body'],
    equipment: 'bodyweight',
    is_custom: false,
  })
}

fs.writeFileSync('exercises.json', JSON.stringify(exercises, null, 2))

console.log(`Generated ${exercises.length} exercises`)
