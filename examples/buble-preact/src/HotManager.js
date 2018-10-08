export default {
    register: function (moduleId) {
        this._moduleId = moduleId;
    },

    getRegistered: function () {
        return this._moduleId;
    }
}