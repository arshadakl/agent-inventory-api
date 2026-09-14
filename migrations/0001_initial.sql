PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE properties (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (
    property_type IN (
      'apartment',
      'villa',
      'house',
      'land',
      'commercial',
      'other'
    )
  ),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  furnished INTEGER NOT NULL DEFAULT 0 CHECK (furnished IN (0, 1)),
  location TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  area_sqft INTEGER CHECK (area_sqft IS NULL OR area_sqft >= 0),
  bedrooms INTEGER CHECK (bedrooms IS NULL OR bedrooms >= 0),
  bathrooms INTEGER CHECK (bathrooms IS NULL OR bathrooms >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (
    status IN ('available', 'sold', 'rented')
  ),
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX idx_properties_listing_type ON properties(listing_type);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_property_type ON properties(property_type);
