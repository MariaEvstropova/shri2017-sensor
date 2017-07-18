ym.modules.define('shri2017.imageViewer.EventManager', [
    'util.extend',
    'shri2017.imageViewer.PointerCollection'
], function (provide, extend, PointerCollection) {
    var EVENTS = {
        mousedown: 'start',
        mousemove: 'move',
        mouseup: 'end',

        touchstart: 'start',
        touchmove: 'move',
        touchend: 'end',
        touchcancel: 'end',

        pointerdown: 'start',
        pointermove: 'move',
        pointerup: 'end',
        pointercancel: 'end',

        wheel: 'wheel',
        mousewheel: 'wheel',
        DOMMouseScroll: 'wheel'
    };

    function EventManager(elem, callback) {
        this._elem = elem;
        this._elementPointers = new PointerCollection();
        this._initialDocumentTouchAction = null;
        this._callback = callback;
        this._setupListeners();
    }

    extend(EventManager.prototype, {
        destroy: function () {
            this._teardownListeners();
        },

        _setupListeners: function () {
            this._mouseListener = this._mouseEventHandler.bind(this);
            this._touchListener = this._touchEventHandler.bind(this);
            this._pointerListener = this._pointerEventHandler.bind(this);
            this._pointerTouchListener = this._pointerTouchHandler.bind(this);
            this._wheelListener = this._wheelEventHandler.bind(this);
            this._preventDefault = this._preventDefault.bind(this);

            //Проверяем поддержку Pointer Events
            if (window.PointerEvent) {
                this._addEventListeners('pointerdown', this._elem, this._pointerListener);
                //В Сhrome на Android при жесте one-touch-zoom происходит масштабирование страницы.
                //Чтобы отменить это поведение необходимо не только добавить атрибут touch-action: none,
                //но и отменить стандартное поведение для touch-событий.
                this._addEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._preventDefault);
            } else {
                this._addEventListeners('mousedown', this._elem, this._mouseListener);
                this._addEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
            }

            if ('onwheel' in document) {
                this._addEventListeners('wheel', this._elem, this._wheelListener);
            } else if ('onmousewheel' in document) {
                this._addEventListeners('mousewheel', this._elem, this._wheelListener);
            } else {
                this._addEventListeners('DOMMouseScroll', this._elem, this._wheelListener);
            }
        },

        _teardownListeners: function () {
            this._removeEventListeners('mousedown', this._elem, this._mouseListener);
            this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            this._removeEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
            this._removeEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._preventDefault);
            this._removeEventListeners('pointerdown', this._elem, this._pointerListener);
            this._removeEventListeners('pointermove pointerup pointercancel', document.documentElement, this._pointerListener);
            this._removeEventListeners('wheel mousewheel DOMMouseScroll', this._elem, this._wheelListener);
        },

        _addEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.addEventListener(type, callback);
            }, this);
        },

        _removeEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.removeEventListener(type, callback);
            }, this);
        },

        _mouseEventHandler: function (event) {
            event.preventDefault();

            if (event.type === 'mousedown') {
                this._addEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            } else if (event.type === 'mouseup') {
                this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            } else if (event.type === 'pointerdown') {
                this._addEventListeners('pointermove pointerup', document.documentElement, this._pointerListener);
            } else if (event.type === 'pointerup') {
                this._removeEventListeners('pointermove pointerup', document.documentElement, this._pointerListener);
            }

            var elemOffset = this._calculateElementOffset(this._elem);

            this._callback({
                type: EVENTS[event.type],
                targetPoint: {
                    x: event.clientX - elemOffset.x,
                    y: event.clientY - elemOffset.y
                },
                distance: 1,
                pointerType: 'mouse'
            });
        },

        _touchEventHandler: function (event) {
            event.preventDefault();

            var touches = event.touches;
            // touchend/touchcancel
            if (touches.length === 0) {
                touches = event.changedTouches;
            }

            this._processTouches(event.type, touches);
        },

        _pointerEventHandler: function(event) {
            if (event.pointerType === 'mouse') {
                this._mouseListener(event);
            } else {
                this._pointerTouchListener(event);
            }
        },

        _pointerTouchHandler: function(event) {
            if (event.type === 'pointerdown') {
                this._initialDocumentTouchAction = document.body.style.touchAction;
                //Отменить стандартное поведение браузера
                document.body.style.touchAction = 'none';

                //Добавить обработчики
                this._addEventListeners('pointermove pointerup pointercancel', document.documentElement, this._pointerListener);

                if (!this._elementPointers.exists(event)) {
                    this._elementPointers.add(event);
                }
            }

            if (event.type === 'pointermove') {
                if (this._elementPointers.exists(event)) {
                    this._elementPointers.update(event);
                }
            }

            var touches = this._elementPointers.getPointers();
            this._processTouches(event.type, touches);

            if (event.type === 'pointerup') {
                if (this._elementPointers.exists(event)) {
                    this._elementPointers.remove(event);
                }

                //Если был удален последний зарегестрированный поинтер, вернуть стандартное поведение браузера
                if (this._elementPointers.getPointers().length === 0) {
                    document.body.style.touchAction = this._initialDocumentTouchAction;

                    this._removeEventListeners('pointermove pointerup pointercancel', document.documentElement, this._pointerListener);
                }
            }
        },

        _processTouches: function(eventType, touches) {
            var targetPoint;
            var distance = 1;
            var elemOffset = this._calculateElementOffset(this._elem);

            if (touches.length === 1) {
                targetPoint = {
                    x: touches[0].clientX,
                    y: touches[0].clientY
                };
            } else {
                var firstTouch = touches[0];
                var secondTouch = touches[1];
                targetPoint = this._calculateTargetPoint(firstTouch, secondTouch);
                distance = this._calculateDistance(firstTouch, secondTouch);
            }

            targetPoint.x -= elemOffset.x;
            targetPoint.y -= elemOffset.y;

            this._callback({
                type: EVENTS[eventType],
                targetPoint: targetPoint,
                distance: distance,
                pointerType: 'touch'
            });
        },

        _wheelEventHandler: function(event) {
            //Предотвратить скролл страницы
            event.preventDefault();
            var elementOffset = this._calculateElementOffset(this._elem);

            //При прокрутке на тачпаде ноутбука генерируются события по осям X и Y
            var spinX = 0;
            var spinY = 0;

            //Для событий mousewheel, DOMMouseScroll
            if ('detail' in event) {
                spinY = event.detail;
            }
            if ('wheelDelta' in event) {
                spinY = - event.wheelDelta / 120;
            }
            if ('wheelDeltaY' in event) {
                spinY = - event.wheelDeltaY / 120; }
            if ('wheelDeltaX' in event) {
                spinX = - event.wheelDeltaX / 120;
            }

            //Прокрутка по оси X для события DOMMouseScroll
            if ( 'axis' in event && event.axis === event.HORIZONTAL_AXIS ) {
                spinX = spinY;
                spinY = 0;
            }

            //Для события "wheel"
            if (event.deltaX && !spinX) {
                spinX = (event.deltaX < 1) ? -1 : 1;
            }
            if (event.deltaY && !spinY) {
                spinY = (event.deltaY < 1) ? -1 : 1;
            }

            this._callback({
                type: EVENTS[event.type],
                targetPoint: {
                    x: event.clientX - elementOffset.x,
                    y: event.clientY - elementOffset.y
                },
                spinX: spinX,
                spinY: spinY,
                pointerType: 'wheel'
            });
        },

        _calculateTargetPoint: function (firstTouch, secondTouch) {
            return {
                x: (secondTouch.clientX + firstTouch.clientX) / 2,
                y: (secondTouch.clientY + firstTouch.clientY) / 2
            };
        },

        _calculateDistance: function (firstTouch, secondTouch) {
            return Math.sqrt(
                Math.pow(secondTouch.clientX - firstTouch.clientX, 2) +
                Math.pow(secondTouch.clientY - firstTouch.clientY, 2)
            );
        },

        _calculateElementOffset: function (elem) {
            var bounds = elem.getBoundingClientRect();
            return {
                x: bounds.left,
                y: bounds.top
            };
        },

        _preventDefault: function(event) {
            event.preventDefault();
        }
    });

    provide(EventManager);
});
