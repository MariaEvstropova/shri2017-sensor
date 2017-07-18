ym.modules.define('shri2017.imageViewer.GestureController', [
    'shri2017.imageViewer.EventManager',
    'util.extend'
], function (provide, EventManager, extend) {
    var DBL_TAP_STEP = 0.2;
    var WHL_ZOOM_FACTOR = 1.1;
    var ONE_TOUCH_ZOOM = 2;

    var Controller = function (view) {
        this._view = view;
        this._eventManager = new EventManager(
            this._view.getElement(),
            this._eventHandler.bind(this)
        );
        this._lastEventTypes = '';
        this._lastEventPointerType = '';
    };

    extend(Controller.prototype, {
        destroy: function () {
            this._eventManager.destroy();
        },

        _eventHandler: function (event) {
            //Считаем, что жест состоит из последовательности событий одного типа
            if (this._lastEventPointerType && event.pointerType !== this._lastEventPointerType) {
                this._resetLastEvent();
            }

            // dblclick
            if (!this._lastEventTypes) {
                setTimeout(function () {
                    //Обрабатываем "one-touch-zoom" по наличию последовательноси 'start end start move'.
                    //Обнулим _lastEventTypes, когда закончим обработку "one touch zoom".
                    if (this._lastEventTypes.indexOf('start end start move') === -1) {
                        this._resetLastEvent();
                    }
                }.bind(this), 500);
            }

            //События move приходят и в том случае, если пользователь "неаккуратно" тапает по экрану.
            //Отсечем те события, которые имеют 0 смещение относительно исходного.
            if (event.type !== 'move' || (event.type === 'move' && this._hasMoveDisplacement(event, this._initEvent))) {
                this._lastEventTypes += ' ' + event.type;
                this._lastEventPointerType = event.pointerType;
            }

            if (this._lastEventTypes.indexOf('start end start end') > -1) {
                this._resetLastEvent();
                this._processDbltap(event);
                return;
            }

            if (this._lastEventTypes.indexOf('start end start move') > -1 && event.pointerType === 'touch') {
                if (event.type === 'end') {
                    //Жест 'one-touch-zoom' закончен - необходимо обнулить очередь событий.
                    this._resetLastEvent();
                    return;
                } else {
                    this._processOneTouchZoom(event);
                    return;
                }
            }

            if (event.type === 'wheel') {
                this._resetLastEvent();
                this._processWheel(event);
                return;
            }

            if (event.type === 'move') {
                if (event.distance > 1 && event.distance !== this._initEvent.distance) {
                    this._processMultitouch(event);
                } else {
                    //Если пользователь делает жест "pinch-to-zoom", он может неодновременно оторвать пальцы по экрана,
                    //тогда начнет приходить событие "move" от оставшегося активным пальца,
                    //чтобы картинка не "перескакивала", инициализируем исходную точку заново.
                    if (/end\smove$/.test(this._lastEventTypes)) {
                        this._initState = this._view.getState();
                        this._initEvent = event;
                    }
                    this._processDrag(event);
                }
            } else {
                this._initState = this._view.getState();
                this._initEvent = event;
            }
        },

        _hasMoveDisplacement: function(event, initEvent) {
            var displacementX = event.targetPoint.x - initEvent.targetPoint.x;
            var displacementY = event.targetPoint.y - initEvent.targetPoint.y;

            return !(displacementX === 0 && displacementY === 0);
        },

        _resetLastEvent: function() {
            this._lastEventTypes = '';
            this._lastEventPointerType = '';
        },

        _processDrag: function (event) {
            this._view.setState({
                positionX: this._initState.positionX + (event.targetPoint.x - this._initEvent.targetPoint.x),
                positionY: this._initState.positionY + (event.targetPoint.y - this._initEvent.targetPoint.y)
            });
        },

        _processMultitouch: function (event) {
            this._scale(
                event.targetPoint,
                this._initState.scale * (event.distance / this._initEvent.distance)
            );
        },

        _processDbltap: function (event) {
            var state = this._view.getState();
            this._scale(
                event.targetPoint,
                state.scale + DBL_TAP_STEP
            );
        },

        _processWheel: function (event) {
            var state = this._view.getState();
            var scale = state.scale;

            //Выбираем отличный от нуля спин, если таких нет - не масштабируем
            var delta = event.spinY || event.spinX;

            if (delta < 0) {
                scale = scale * WHL_ZOOM_FACTOR;
            } else if (delta > 0) {
                scale = scale / WHL_ZOOM_FACTOR;
            }

            this._scale(
                event.targetPoint,
                scale
            );
        },

        _processOneTouchZoom: function(event) {
            var delta = event.targetPoint.y - this._initEvent.targetPoint.y;
            var imageHeight = this._view.getImageSize().height;

            this._scale(
                this._initEvent.targetPoint,
                this._initState.scale + delta * ONE_TOUCH_ZOOM / imageHeight
            );
        },

        _scale: function (targetPoint, newScale) {
            newScale = Math.max(Math.min(newScale, 10), 0.02);
            var imageSize = this._view.getImageSize();
            var state = this._view.getState();
            // Позиция прикосновения на изображении на текущем уровне масштаба
            var originX = targetPoint.x - state.positionX;
            var originY = targetPoint.y - state.positionY;
            // Размер изображения на текущем уровне масштаба
            var currentImageWidth = imageSize.width * state.scale;
            var currentImageHeight = imageSize.height * state.scale;
            // Относительное положение прикосновения на изображении
            var mx = originX / currentImageWidth;
            var my = originY / currentImageHeight;
            // Размер изображения с учетом нового уровня масштаба
            var newImageWidth = imageSize.width * newScale;
            var newImageHeight = imageSize.height * newScale;
            // Рассчитываем новую позицию с учетом уровня масштаба
            // и относительного положения прикосновения
            state.positionX += originX - (newImageWidth * mx);
            state.positionY += originY - (newImageHeight * my);
            // Устанавливаем текущее положение мышки как "стержневое"
            state.pivotPointX = targetPoint.x;
            state.pivotPointY = targetPoint.y;
            // Устанавливаем масштаб и угол наклона
            state.scale = newScale;
            this._view.setState(state);
        }
    });

    provide(Controller);
});
