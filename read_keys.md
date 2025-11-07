## Retrieve Tuya / LEDVANCE Local Keys

These steps document how to pull refreshed local keys directly from the LEDVANCE cloud using the `ha-ledvance-tuya-resync-localkey` helper that ships in this repo as a git submodule.

### 1. Prepare the helper project

```bash
git submodule update --init --recursive submodules/ha-ledvance-tuya-resync-localkey
cd submodules/ha-ledvance-tuya-resync-localkey
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

### 2. Print your keys

```bash
uv run print-local-keys.py
```

When prompted, enter the same Tuya/LEDVANCE username and password you use in the mobile app.  
The script prints each device name, device id, and the corresponding `local key`, for example:

```
device name:    LightStrip
device id:      bfbb881460ea1e949fk09z
local key:      N?<@B=Y;r9S|>kxk
```

Copy the `device id`/`local key` pairs into your `config.json` (or secret manager of choice) so Homebridge-Tuya can connect locally. Press **Enter** to exit the script when you finish.
