#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE axiom_users;
    CREATE DATABASE axiom_analysis;
    CREATE DATABASE axiom_stocks;
EOSQL

