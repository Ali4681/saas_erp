-- Employee engagement: wage worker (أجير) vs employment contract (مسجل بعقد عمل)
ALTER TABLE `employees`
  ADD COLUMN `employment_category` ENUM('WAGE_WORKER', 'EMPLOYMENT_CONTRACT') NOT NULL DEFAULT 'EMPLOYMENT_CONTRACT';
