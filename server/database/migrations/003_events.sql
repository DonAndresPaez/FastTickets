CREATE TABLE race (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    race_name TEXT NOT NULL,
    city TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    UNIQUE (race_name, city, start_date, end_date)
);

CREATE TABLE tickets (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    race_id INTEGER NOT NULL REFERENCES race(id),
    event_day DATE NOT NULL,
    quantity INTEGER NOT NULL,
    "row" TEXT, -- general admission tickets will have a null row
    section TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    location TEXT NOT NULL, -- describes the location on the track, not race location
);