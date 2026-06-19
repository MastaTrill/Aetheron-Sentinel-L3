#!/bin/sh
set -eu

load_secret() {
    var_name=$1
    secret_path="/run/secrets/$2"
    if [ -f "$secret_path" ]; then
        export "$var_name"=$(cat "$secret_path")
        echo "Loaded $var_name from secrets"
    else
        echo "Warning: Secret $2 not found"
    fi
}

load_secret "DEPLOYER_PRIVATE_KEY" "deployer_private_key"
load_secret "INFURA_API_KEY" "infura_api_key"
load_secret "OPENAI_API_KEY" "openai_api_key"
load_secret "CDP_API_KEY_PRIVATE_KEY" "cdp_api_key_private_key"
load_secret "PHI4_API_KEY" "phi4_api_key"

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

exec npm start
