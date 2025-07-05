let numericAmount = 200000;
let apy = 30;
let duration = 365;
let durationUnit = "days";

function calculateReward(
  numericAmount: number,
  apy: number,
  duration: number,
  durationUnit: string,
  compoundingFrequency: string
): number {
  const annualRate = apy / 100;

  // Convert duration to years based on the duration unit
  const durationInYears =
    durationUnit.toLowerCase() === "days" ? duration / 365 : duration;

  // Determine compounding frequency
  const compoundingPeriods =
    compoundingFrequency.toLowerCase() === "daily"
      ? 365
      : compoundingFrequency.toLowerCase() === "monthly"
      ? 12
      : 1; // Default to yearly if not specified

  // Compound interest formula: A = P * (1 + r/n)^(n*t)
  const reward =
    numericAmount *
      Math.pow(
        1 + annualRate / compoundingPeriods,
        compoundingPeriods * durationInYears
      ) -
    numericAmount;

  return reward;
}

// function calculateReward(
//   principal: number,
//   apy: number,
//   duration: number,
//   durationUnit: string
// ): number {
//   const annualRate = apy / 100;
//   const durationInYears =
//     durationUnit.toLowerCase() === "days" ? duration / 365 : duration;
//   const total = principal * Math.pow(1 + annualRate, durationInYears);
//   const reward = total - principal;
//   return Math.round(reward * 100) / 100; // rounding to 2 decimals
// }

let reward = calculateReward(
  numericAmount,
  apy,
  duration,
  durationUnit,
  "daily"
);
console.log(reward);
