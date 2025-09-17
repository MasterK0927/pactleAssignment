-- Migration: Create user credits table

-- Table: user_credits
CREATE TABLE user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_credits_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for user_credits
CREATE UNIQUE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_credits ON user_credits(credits);

-- Add trigger for updated_at
CREATE TRIGGER update_user_credits_updated_at 
    BEFORE UPDATE ON user_credits 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default credits for existing users (if any)
INSERT INTO user_credits (user_id, credits)
SELECT id, 10 FROM users
ON CONFLICT (user_id) DO NOTHING;
