-- Add parent_id to indicators so sub-indicators can belong to a parent
-- whose value is computed as the sum of its children.
ALTER TABLE indicators
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES indicators(id) ON DELETE SET NULL;
