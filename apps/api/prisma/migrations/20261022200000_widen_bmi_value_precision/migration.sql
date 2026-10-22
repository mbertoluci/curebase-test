-- Widen bmi_value from Decimal(5,2) to Decimal(6,2). The per-unit plausibility
-- bounds accept valid-but-extreme measurement pairs (e.g. 500 kg / 50 cm, or
-- 1100 lb / 20 in) whose computed BMI exceeds 999.99. Decimal(5,2) overflowed on
-- those, turning a valid request into a 500 at write time; Decimal(6,2) holds
-- the full range the bounds allow.
ALTER TABLE "participants"
  ALTER COLUMN "bmi_value" TYPE DECIMAL(6, 2);
