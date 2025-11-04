### deploy-homebridge.sh

Helper script that packages the current plugin and uploads the tarball to your Homebridge server.

Defaults:
- host: `homebridge.local`
- user: `pi`
- password: `raspberry`
- destination: `/home/pi`

Override by exporting `HB_HOST`, `HB_USER`, `HB_PASSWORD`, or `HB_DEST` before running.

Usage:
```bash
chmod +x scripts/deploy-homebridge.sh     # once
HB_HOST=192.168.1.25 HB_USER=pi ./scripts/deploy-homebridge.sh
```

Once the tarball is on the Homebridge host, SSH in and replace the plugin manually:
```bash
ssh pi@homebridge.local
sudo npm uninstall --prefix /var/lib/homebridge homebridge-tuya
sudo npm install  --prefix /var/lib/homebridge --unsafe-perm /home/pi/homebridge-tuya-3.1.1.tgz
sudo hb-service restart
```

Remove the tarball (`rm /home/pi/homebridge-tuya-3.1.1.tgz`) after confirming the new build loads correctly.
