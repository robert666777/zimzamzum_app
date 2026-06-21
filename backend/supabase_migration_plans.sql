-- Ajouter le champ is_admin à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Table des plans disponibles
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    period_days INTEGER,
    features TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des plans actifs des utilisateurs
CREATE TABLE IF NOT EXISTS user_plans (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    plan_id TEXT NOT NULL REFERENCES plans(id),
    is_trial BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des demandes de paiement
CREATE TABLE IF NOT EXISTS payment_requests (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    user_name TEXT NOT NULL,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    confirmed_by TEXT REFERENCES users(id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS ix_user_plans_user_id ON user_plans(user_id);
CREATE INDEX IF NOT EXISTS ix_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS ix_payment_requests_status ON payment_requests(status);

-- Insérer les plans
INSERT INTO plans (id, name, price, period_days, features) VALUES
('free', 'Free', 0, 1, '["1-day free trial on every new account","Full access to all features","Free during your trial"]'),
('starter', 'Starter', 49, 30, '["Full access to every feature in zimzamzum","Assignments checked, analyzed, saved, submitted, compiled","Use it as often as you need – no monthly cap"]'),
('semester', 'Semester', 199, 180, '["Everything in Starter for a full semester window","Daily homework support throughout the whole semester","Best value if you only need a single-semester boost"]'),
('annual', 'Annual', 399, 365, '["Full access for the entire academic year","Daily assignments support throughout both semesters","Faster responses and priority handling when it matters","Lowest equivalent monthly cost"]')
ON CONFLICT DO NOTHING;

-- Mettre à jour roberto comme admin (remplace par ton vrai email ou nom)
UPDATE users SET is_admin = TRUE WHERE name ILIKE '%Roberto%' OR email ILIKE '%Roberto%';
