export default class TokenConfig extends FormApplication {

    constructor(name, imgSrc, actorData) {
        super({
            name: name, 
            imgSrc: imgSrc,
            alpha: actorData.alpha,
            height: actorData.height,
            width: actorData.width,
            scale: actorData.scale,
            tint: actorData.tint,
            mirrorX: actorData.mirrorX,
            mirrorY: actorData.mirrorY
        }, {title: `${name}: Token Configuration`});
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "token-variants-token-config",
            classes: ["sheet"],
            template: "modules/token-variants/templates/tokenConfig.html",
            resizable: false,
            minimizable: false,
            closeOnSubmit: true,
            width: 480,
            height: "auto",
            dragDrop: [{dragSelector: null, dropSelector: null}]
        });
    }

    async getData(options) {
        let data = super.getData(options).object;
        const tokenConfigs = game.settings.get("token-variants", "tokenConfigs");
        const tokenConfig = tokenConfigs.find(config => config.imgSrc == data.imgSrc && config.name == data.name);
        if(tokenConfig){
            data = mergeObject(data, tokenConfig);
        }
        return data;
    }

    /**
     * @param {JQuery} html
     */
    activateListeners(html) {
        super.activateListeners(html);
        html.find(".remove-config").click(this._onRemoveConfig.bind(this));
    }

    async _onRemoveConfig(event){
        const tokenConfigs = game.settings.get("token-variants", "tokenConfigs");
        const tcIndex = tokenConfigs.findIndex(config => config.imgSrc == this.object.imgSrc && config.name == this.object.name);
        if(tcIndex != -1){
            tokenConfigs.splice(tcIndex, 1);
            game.settings.set("token-variants", "tokenConfigs", tokenConfigs);
        }
        this.close();
    }

    async _updateObject(event, formData) {
        const expanded = foundry.utils.expandObject(formData);
        const tokenConfigs = game.settings.get("token-variants", "tokenConfigs");
        const tcIndex = tokenConfigs.findIndex(config => config.imgSrc == this.object.imgSrc && config.name == this.object.name);
        if(tcIndex != -1){
            tokenConfigs[tcIndex] = mergeObject(tokenConfigs[tcIndex], expanded);
        } else {
            tokenConfigs.push(mergeObject(this.object, expanded));
        }
        game.settings.set("token-variants", "tokenConfigs", tokenConfigs);
    }
}
