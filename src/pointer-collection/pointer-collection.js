ym.modules.define('shri2017.imageViewer.PointerCollection', [
    'util.extend'
], function (provide, extend) {

    function PointerCollection() {
        this._pointers = {};
    }

    extend(PointerCollection.prototype, {
        destroy: function () {
            this._pointers = null;
        },

        add: function (event) {
            this._pointers[event.pointerId] = event;
        },

        update: function(event) {
            this.add(event);
        },

        remove: function(event) {
            delete this._pointers[event.pointerId];
        },

        exists: function(event) {
            return this._pointers.hasOwnProperty(event.pointerId);
        },

        getPointers: function() {
            var pointers = [];

            for (pointer in this._pointers) {
                if (this._pointers.hasOwnProperty(pointer)) {
                    var event = {};

                    event.clientX = this._pointers[pointer]['clientX'];
                    event.clientY = this._pointers[pointer]['clientY'];

                    pointers.push(event);
                }
            }

            return pointers;
        }
    });

    provide(PointerCollection);
});
