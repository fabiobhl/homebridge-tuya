const BaseAccessory = require('./BaseAccessory');
const async = require('async');

class RGBTWLightAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.LIGHTBULB;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        this.accessory.addService(Service.Lightbulb, this.device.context.name);

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic, AdaptiveLightingController} = this.hap;
        const service = this.accessory.getService(Service.Lightbulb);
        this._checkServiceName(service, this.device.context.name);

        this.dpPower = this._getCustomDP(this.device.context.dpPower) || '1';
        this.dpMode = this._getCustomDP(this.device.context.dpMode) || '2';
        this.dpBrightness = this._getCustomDP(this.device.context.dpBrightness) || '3';
        this.dpColorTemperature = this._getCustomDP(this.device.context.dpColorTemperature) || '4';
        this.dpColor = this._getCustomDP(this.device.context.dpColor) || '5';

        this.hasModeDP = typeof dps[this.dpMode] !== 'undefined';

        this._detectColorFunction(dps[this.dpColor]);

        this.currentColorDP = dps[this.dpColor];

        const initialColorState = this.convertColorFromTuyaToHomeKit(this.currentColorDP);
        const isWhiteMode = this.hasModeDP ? dps[this.dpMode] === this.cmdWhite : true;

        this.cmdWhite = 'white';
        if (this.device.context.cmdWhite) {
            if (/^w[a-z]+$/i.test(this.device.context.cmdWhite)) this.cmdWhite = ('' + this.device.context.cmdWhite).trim();
            else throw new Error(`The cmdWhite doesn't appear to be valid: ${this.device.context.cmdWhite}`);
        }

        this.cmdColor = 'colour';
        if (this.device.context.cmdColor) {
            if (/^c[a-z]+$/i.test(this.device.context.cmdColor)) this.cmdColor = ('' + this.device.context.cmdColor).trim();
            else throw new Error(`The cmdColor doesn't appear to be valid: ${this.device.context.cmdColor}`);
        } else if (this.device.context.cmdColour) {
            if (/^c[a-z]+$/i.test(this.device.context.cmdColour)) this.cmdColor = ('' + this.device.context.cmdColour).trim();
            else throw new Error(`The cmdColour doesn't appear to be valid: ${this.device.context.cmdColour}`);
        }

        const characteristicOn = service.getCharacteristic(Characteristic.On)
            .updateValue(dps[this.dpPower])
            .on('get', this.getState.bind(this, this.dpPower))
            .on('set', this.setState.bind(this, this.dpPower));

        const initialBrightness = this.hasModeDP
            ? (isWhiteMode
                ? this.convertBrightnessFromTuyaToHomeKit(dps[this.dpBrightness])
                : initialColorState.b)
            : this.convertBrightnessFromTuyaToHomeKit(dps[this.dpBrightness]);

        const characteristicBrightness = service.getCharacteristic(Characteristic.Brightness)
            .updateValue(initialBrightness)
            .on('get', this.getBrightness.bind(this))
            .on('set', this.setBrightness.bind(this));
        this.characteristicBrightness = characteristicBrightness;

        const initialColorTemperature = isWhiteMode
            ? this.convertColorTemperatureFromTuyaToHomeKit(dps[this.dpColorTemperature])
            : 0;

        const characteristicColorTemperature = service.getCharacteristic(Characteristic.ColorTemperature)
            .setProps({
                minValue: 0,
                maxValue: 600
            })
            .updateValue(initialColorTemperature)
            .on('get', this.getColorTemperature.bind(this))
            .on('set', this.setColorTemperature.bind(this));

        const characteristicHue = service.getCharacteristic(Characteristic.Hue)
            .updateValue(isWhiteMode ? 0 : initialColorState.h)
            .on('get', this.getHue.bind(this))
            .on('set', this.setHue.bind(this));

        const characteristicSaturation = service.getCharacteristic(Characteristic.Saturation)
            .updateValue(isWhiteMode ? 0 : initialColorState.s)
            .on('get', this.getSaturation.bind(this))
            .on('set', this.setSaturation.bind(this));

        this.characteristicHue = characteristicHue;
        this.characteristicSaturation = characteristicSaturation;
        this.characteristicColorTemperature = characteristicColorTemperature;

        if (this.adaptiveLightingSupport()) {
            this.adaptiveLightingController = new AdaptiveLightingController(service);
            this.accessory.configureController(this.adaptiveLightingController);
            this.accessory.adaptiveLightingController = this.adaptiveLightingController;
        }

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpPower) && characteristicOn.value !== changes[this.dpPower]) characteristicOn.updateValue(changes[this.dpPower]);

            if (!this.hasModeDP) {
                if (changes.hasOwnProperty(this.dpBrightness) && this.convertBrightnessFromHomeKitToTuya(characteristicBrightness.value) !== changes[this.dpBrightness])
                    characteristicBrightness.updateValue(this.convertBrightnessFromTuyaToHomeKit(changes[this.dpBrightness]));

                if (changes.hasOwnProperty(this.dpColorTemperature)) {
                    const newColorTemperature = this.convertColorTemperatureFromTuyaToHomeKit(changes[this.dpColorTemperature]);
                    characteristicColorTemperature.updateValue(newColorTemperature);
                    const syncedColor = this.convertHomeKitColorTemperatureToHomeKitColor(newColorTemperature);
                    characteristicHue.updateValue(syncedColor.h);
                    characteristicSaturation.updateValue(syncedColor.s);
                }

                if (changes.hasOwnProperty(this.dpColor)) {
                    const oldColor = this.convertColorFromTuyaToHomeKit(this.convertColorFromHomeKitToTuya({
                        h: characteristicHue.value,
                        s: characteristicSaturation.value,
                        b: characteristicBrightness.value
                    }));
                    const newColor = this.convertColorFromTuyaToHomeKit(changes[this.dpColor]);

                    if (oldColor.b !== newColor.b) characteristicBrightness.updateValue(newColor.b);
                    if (oldColor.h !== newColor.h) characteristicHue.updateValue(newColor.h);

                    if (oldColor.s !== newColor.s) characteristicSaturation.updateValue(newColor.s);

                    this.currentColorDP = state[this.dpColor];
                }

                return;
            }

            switch (state[this.dpMode]) {
                case this.cmdWhite:
                    if (changes.hasOwnProperty(this.dpBrightness) && this.convertBrightnessFromHomeKitToTuya(characteristicBrightness.value) !== changes[this.dpBrightness])
                        characteristicBrightness.updateValue(this.convertBrightnessFromTuyaToHomeKit(changes[this.dpBrightness]));

                    if (changes.hasOwnProperty(this.dpColorTemperature) && this.convertColorTemperatureFromHomeKitToTuya(characteristicColorTemperature.value) !== changes[this.dpColorTemperature]) {

                        const newColorTemperature = this.convertColorTemperatureFromTuyaToHomeKit(changes[this.dpColorTemperature]);
                        const newColor = this._getTintedColorForTemperature(newColorTemperature);

                        characteristicHue.updateValue(newColor.h);
                        characteristicSaturation.updateValue(newColor.s);
                        characteristicColorTemperature.updateValue(newColorTemperature);

                    } else if (changes[this.dpMode] && !changes.hasOwnProperty(this.dpColorTemperature)) {

                        const newColorTemperature = this.convertColorTemperatureFromTuyaToHomeKit(state[this.dpColorTemperature]);
                        const newColor = this._getTintedColorForTemperature(newColorTemperature);

                        characteristicHue.updateValue(newColor.h);
                        characteristicSaturation.updateValue(newColor.s);
                        characteristicColorTemperature.updateValue(newColorTemperature);
                    }

                    break;

                default:
                    if (changes.hasOwnProperty(this.dpColor)) {
                        const oldColor = this.convertColorFromTuyaToHomeKit(this.convertColorFromHomeKitToTuya({
                            h: characteristicHue.value,
                            s: characteristicSaturation.value,
                            b: characteristicBrightness.value
                        }));
                        const newColor = this.convertColorFromTuyaToHomeKit(changes[this.dpColor]);

                        if (oldColor.b !== newColor.b) characteristicBrightness.updateValue(newColor.b);
                        if (oldColor.h !== newColor.h) characteristicHue.updateValue(newColor.h);

                        if (oldColor.s !== newColor.s) characteristicSaturation.updateValue(newColor.s);

                        if (characteristicColorTemperature.value !== 0) characteristicColorTemperature.updateValue(0);

                        this.currentColorDP = state[this.dpColor];
                    } else if (changes[this.dpMode]) {
                        if (characteristicColorTemperature.value !== 0) characteristicColorTemperature.updateValue(0);
                    }
            }
        });
    }

    getBrightness(callback) {
        if (!this.hasModeDP) return callback(null, this.convertBrightnessFromTuyaToHomeKit(this.device.state[this.dpBrightness]));
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, this.convertBrightnessFromTuyaToHomeKit(this.device.state[this.dpBrightness]));
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).b);
    }

    setBrightness(value, callback) {
        if (!this.hasModeDP) {
            const tuyaBrightness = this.convertBrightnessFromHomeKitToTuya(value);
            const colorValue = this.convertColorFromHomeKitToTuya({b: value}, this.currentColorDP);
            return this.setMultiState({
                [this.dpBrightness]: tuyaBrightness,
                [this.dpColor]: colorValue
            }, err => {
                if (!err) this.currentColorDP = colorValue;
                callback && callback(err);
            });
        }

        if (this.device.state[this.dpMode] === this.cmdWhite) return this.setState(this.dpBrightness, this.convertBrightnessFromHomeKitToTuya(value), callback);
        const colorValue = this.convertColorFromHomeKitToTuya({b: value}, this.currentColorDP);
        this.setState(this.dpColor, colorValue, err => {
            if (!err) this.currentColorDP = colorValue;
            callback && callback(err);
        });
    }

    _getTintedColorForTemperature(value) {
        const color = this.convertHomeKitColorTemperatureToHomeKitColor(value);
        if (!this.hasModeDP) {
            const brightness = this.characteristicBrightness && typeof this.characteristicBrightness.value === 'number'
                ? this.characteristicBrightness.value
                : this.convertBrightnessFromTuyaToHomeKit(this.device.state[this.dpBrightness]);
            color.b = brightness;

            const coolCt = 140;
            const warmCt = 600;
            const clampedValue = Math.max(coolCt, Math.min(warmCt, value));
            const range = warmCt - coolCt || 1;
            const ratio = (clampedValue - coolCt) / range;

            const coolTargetHue = 50;
            const coolTargetSaturation = 60;
            const warmTargetHue = 35;
            const warmTargetSaturation = 80;

            const transitionStart = 0.3;
            const blendRatio = ratio <= transitionStart ? 0 : Math.pow((ratio - transitionStart) / (1 - transitionStart), 1.5);

            if (blendRatio <= 0) {
                color.h = coolTargetHue;
                color.s = coolTargetSaturation;
            } else {
                const baseHue = color.h;
                const baseSaturation = color.s;

                const hueBlend = ((warmTargetHue - baseHue + 540) % 360) - 180;
                const blendedHue = (baseHue + hueBlend * blendRatio + 360) % 360;
                color.h = Math.round(blendedHue);

                const blendedSaturation = baseSaturation + (warmTargetSaturation - baseSaturation) * blendRatio;
                const clampedSaturation = Math.max(0, Math.min(100, blendedSaturation));
                color.s = Math.round(clampedSaturation + (coolTargetSaturation - clampedSaturation) * (1 - blendRatio));
            }
        }
        return color;
    }

    getColorTemperature(callback) {
        if (!this.hasModeDP) return callback(null, this.convertColorTemperatureFromTuyaToHomeKit(this.device.state[this.dpColorTemperature]));
        if (this.device.state[this.dpMode] !== this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorTemperatureFromTuyaToHomeKit(this.device.state[this.dpColorTemperature]));
    }

    setColorTemperature(value, callback) {
        this.log.debug(`setColorTemperature: ${value}`);
        if (value === 0) return callback(null, true);

        const newColor = this._getTintedColorForTemperature(value);
        this.characteristicHue.updateValue(newColor.h);
        this.characteristicSaturation.updateValue(newColor.s);

        const payload = this.hasModeDP
            ? {[this.dpMode]: this.cmdWhite, [this.dpColorTemperature]: this.convertColorTemperatureFromHomeKitToTuya(value)}
            : {
                [this.dpColorTemperature]: this.convertColorTemperatureFromHomeKitToTuya(value),
                [this.dpColor]: this.convertColorFromHomeKitToTuya(newColor, this.currentColorDP)
            };

        this.setMultiState(payload, err => {
            if (!err && payload[this.dpColor]) this.currentColorDP = payload[this.dpColor];
            callback && callback(err);
        });
    }

    getHue(callback) {
        if (!this.hasModeDP) return callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).h);
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).h);
    }

    setHue(value, callback) {
        this._setHueSaturation({h: value}, callback);
    }

    getSaturation(callback) {
        if (!this.hasModeDP) return callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).s);
        if (this.device.state[this.dpMode] === this.cmdWhite) return callback(null, 0);
        callback(null, this.convertColorFromTuyaToHomeKit(this.device.state[this.dpColor]).s);
    }

    setSaturation(value, callback) {
        this._setHueSaturation({s: value}, callback);
    }

    _setHueSaturation(prop, callback) {
        if (!this._pendingHueSaturation) {
            this._pendingHueSaturation = {props: {}, callbacks: []};
        }

        if (prop) {
            if (this._pendingHueSaturation.timer) clearTimeout(this._pendingHueSaturation.timer);

            this._pendingHueSaturation.props = {...this._pendingHueSaturation.props, ...prop};
            if (this.characteristicBrightness && typeof this.characteristicBrightness.value === 'number') {
                this._pendingHueSaturation.props.b = this.characteristicBrightness.value;
            }
            this._pendingHueSaturation.callbacks.push(callback);

            this._pendingHueSaturation.timer = setTimeout(() => {
                this._setHueSaturation();
            }, 500);
            return;
        }

        //this.characteristicColorTemperature.updateValue(0);

        const callbacks = this._pendingHueSaturation.callbacks;
        const callEachBack = err => {
            async.eachSeries(callbacks, (callback, next) => {
                try {
                    callback(err);
                } catch (ex) {}
                next();
            }, () => {
                if (this.hasModeDP) this.characteristicColorTemperature.updateValue(0);
            });
        };

        const isSham = this._pendingHueSaturation.props.h === 0 && this._pendingHueSaturation.props.s === 0;
        const newValue = this.convertColorFromHomeKitToTuya(this._pendingHueSaturation.props);
        this._pendingHueSaturation = null;


        if (this.hasModeDP) {
            if (this.device.state[this.dpMode] === this.cmdWhite && isSham) return callEachBack();
            this.setMultiState({[this.dpMode]: this.cmdColor, [this.dpColor]: newValue}, err => {
                if (!err) this.currentColorDP = newValue;
                callEachBack(err);
            });
            return;
        }

        this.setState(this.dpColor, newValue, err => {
            if (!err) this.currentColorDP = newValue;
            callEachBack(err);
        });
    }

    getControllers() {
        if (!this.adaptiveLightingController) {
            return [];
        } else {
            return [this.adaptiveLightingController];
        }
      }
}

module.exports = RGBTWLightAccessory;
