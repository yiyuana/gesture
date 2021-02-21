let element = document.documentElement;

let isListeningMouse = false;

// 鼠标操作事件
element.addEventListener("mousedown", event => {
    let context = Object.create(null);

    // 移位存，1、2、4、8、16，参考二进制计算方式
    contexts.set("mouse" + (1 << event.button), context);
    start(event, context);

    let mousemove = event => {
        let button = 1;
        // move这边是掩码的格式，需要做移位比较， 例如0b0001、0b0010
        while(button <= event.buttons) {
            if (button & event.buttons) {
                // console.log(contexts, button, event.buttons)
                // 右键和中键的顺序调整为正常的值
                let key;
                if (button === 2)
                    key = 4;
                else if (button === 4)
                    key = 2;
                else
                    key = button;

                let context = contexts.get("mouse" + key);
                move(event, context);
            }
            button = button << 1;
        }
    }

    let mouseup = event => {
        let context = contexts.get("mouse" + (1 << event.button));
        end(event, context);
        contexts.delete("mouse" + (1 << event.button));

        // 没有任何鼠标事件，再remove掉
        if (event.buttons === 0) {
            document.removeEventListener("mousemove", mousemove);
            document.removeEventListener("mouseup", mouseup);
            isListeningMouse = false;
        }
    }

    // 防止多次监听
    if (!isListeningMouse) {
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", mouseup);
        isListeningMouse = true;
    }

})

let contexts = new Map();

// 移动端手势监听
element.addEventListener("touchstart", event => {
    for(let touch of event.changedTouches) {
        let context = Object.create(null);
        contexts.set(touch.identifier, context);
        start(touch, context);
    }
})
element.addEventListener("touchmove", event => {
    for(let touch of event.changedTouches) {
        let context = contexts.get(touch.identifier);
        move(touch, context);
    }
})
element.addEventListener("touchend", event => {
    for(let touch of event.changedTouches) {
        let context = contexts.get(touch.identifier);
        end(touch, context);
        contexts.delete(touch.identifier);
    }
})
// 异常结束touch时触发
element.addEventListener("touchcancel", event => {
    for(let touch of event.changedTouches) {
        let context = contexts.get(touch.identifier);
        cancel(touch, context);
        contexts.delete(touch.identifier);
    }
})


// let handler;
// let startX, startY;
// let isPan = false,
//     isTap = true,
//     isPress = false;

// pc端和移动端共同的移动操作事件

let start = (point, context) => {
    // console.log("start", point.clientX, point.clientY);
    context.startX = point.clientX, context.startY = point.clientY;

    context.isTap = true; // 轻触
    context.isPan = false; // 达到10px的距离的移动了吗，达到才算平移，移动端会出现的一个手势接触问题，消除刚触屏就触发事件
    context.isPress = false; // 按压事件
    context.points = [];

    // 0.5秒后为按压事件
    context.handler = setTimeout(() => {
        context.isTap = false;
        context.isPan = false;
        context.isPress = true;
        context.handler = null;
        console.log("press");
    }, 500)
}

let move = (point, context) => {
    // console.log("move", point.clientX, point.clientY);
    let dx = point.clientX - context.startX, dy = point.clientY - context.startY;

    if (!context.isPan && dx ** 2 + dy ** 2 > 100) {
        context.isTap = false;
        context.isPan = true;
        context.isPress = false;
        clearTimeout(context.handler);
        console.log("pan start");
    }

    if (context.isPan) {
        console.log(dx, dy);
        console.log("pan");
    }

    // 处理fick事件，速度快速滑动的触发事件
    // 只存储半秒内的位置
    context.points = context.points.filter(point => Date.now() - point.t < 500);

    context.points.push({
        t: Date.now(),
        x: point.clientX,
        y: point.clientY,
    })
}

let end = (point, context) => {
    // console.log("end", point.clientX, point.clientY);
    if (context.isTap) {
        // console.log("tap");
        dispatch("tap", {});
        clearTimeout(context.handler);
    }
    if (context.isPan) {
        console.log("pan end");
    }
    if (context.isPress) {
        console.log("press end")
    }

    context.points = context.points.filter(point => Date.now() - point.t < 500);

    // 算出距离和速度
    let v, d;
    if (!context.points.length) {
        v = 0;
    } else {
        // 距离需要开根号，保证数据的准确性
        d = Math.sqrt((point.clientX - context.points[0].x) ** 2 +
            (point.clientY - context.points[0].y) ** 2);
        v = d / (Date.now() - context.points[0].t);
    }

    // 单位，像素/每毫秒
    if (v > 1.5) {
        console.log("flick");
        context.isFlick = true;
    } else {
        context.isFlick = false;
    }
    console.log(v);
}

let cancel = (point, context) => {
    clearTimeout(context.handler);
    console.log("cancel", point.clientX, point.clientY);
}

// 事件派发
function dispatch(type, properties) {
    let event = new Event(type);
    for(let name in properties) {
        event[name] = properties[name];
    }
    element.dispatchEvent(event);
}

// 分为三部分，listen(监听)=>recognize(识别)=>dispatch(分发)