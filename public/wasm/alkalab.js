/* @ts-self-types="./alkalab.d.ts" */

/**
 * The engine handle JavaScript talks to.
 *
 * ```js
 * const engine = new Engine(320, 200, seed >>> 0);
 * const pixels = new Uint8ClampedArray(
 *   wasm.memory.buffer,
 *   engine.pixel_ptr,
 *   engine.pixel_len,
 * );
 * ```
 */
export class Engine {
    static __wrap(ptr) {
        const obj = Object.create(Engine.prototype);
        obj.__wbg_ptr = ptr;
        EngineFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_engine_free(ptr, 0);
    }
    /**
     * Is there a snapshot on the undo stack?
     * @returns {boolean}
     */
    get can_undo() {
        const ret = wasm.engine_can_undo(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Empties the world (undoable).
     */
    clear() {
        wasm.engine_clear(this.__wbg_ptr);
    }
    /**
     * How many cells are made of `element`.
     * @param {number} element
     * @returns {number}
     */
    count_of(element) {
        const ret = wasm.engine_count_of(this.__wbg_ptr, element);
        return ret >>> 0;
    }
    /**
     * Creates an engine at the default `320 x 200` size.
     * @param {number} seed
     * @returns {Engine}
     */
    static create(seed) {
        const ret = wasm.engine_create(seed);
        return Engine.__wrap(ret);
    }
    /**
     * Detonates a charge, releasing smoke (the "boom" tool).
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     */
    detonate(x, y, radius) {
        wasm.engine_detonate(this.__wbg_ptr, x, y, radius);
    }
    /**
     * Element id at `(x, y)`.
     * @param {number} x
     * @param {number} y
     * @returns {number}
     */
    element_at(x, y) {
        const ret = wasm.engine_element_at(this.__wbg_ptr, x, y);
        return ret;
    }
    /**
     * The element catalogue as a JSON array, so the UI palette is generated
     * from the Rust property table instead of duplicating it in JavaScript.
     * @returns {string}
     */
    element_catalog() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.engine_element_catalog(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Ticks simulated so far.
     * @returns {number}
     */
    get frame() {
        const ret = wasm.engine_frame(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Fingerprint of the whole state buffer.
     * @returns {number}
     */
    get hash() {
        const ret = wasm.engine_hash(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * World height in cells.
     * @returns {number}
     */
    get height() {
        const ret = wasm.engine_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * Creates an engine with an explicit size and RNG seed.
     * @param {number} width
     * @param {number} height
     * @param {number} seed
     */
    constructor(width, height, seed) {
        const ret = wasm.engine_new(width, height, seed);
        this.__wbg_ptr = ret;
        EngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Paints a round brush of `element` at `(x, y)`.
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {number} element
     * @returns {number}
     */
    paint(x, y, radius, element) {
        const ret = wasm.engine_paint(this.__wbg_ptr, x, y, radius, element);
        return ret >>> 0;
    }
    /**
     * Paints a stroke between two pointer positions, filling in the gaps of a
     * fast drag.
     * @param {number} x0
     * @param {number} y0
     * @param {number} x1
     * @param {number} y1
     * @param {number} radius
     * @param {number} element
     * @returns {number}
     */
    paint_line(x0, y0, x1, y1, radius, element) {
        const ret = wasm.engine_paint_line(this.__wbg_ptr, x0, y0, x1, y1, radius, element);
        return ret >>> 0;
    }
    /**
     * Paints a filled rectangle, used by the square brush and the demos.
     * @param {number} x0
     * @param {number} y0
     * @param {number} x1
     * @param {number} y1
     * @param {number} element
     * @returns {number}
     */
    paint_rect(x0, y0, x1, y1, element) {
        const ret = wasm.engine_paint_rect(this.__wbg_ptr, x0, y0, x1, y1, element);
        return ret >>> 0;
    }
    /**
     * How many cells are not air (shown in the HUD).
     * @returns {number}
     */
    get particle_count() {
        const ret = wasm.engine_particle_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Length of the shared RGBA buffer in bytes.
     * @returns {number}
     */
    get pixel_len() {
        const ret = wasm.engine_pixel_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Pointer to the shared RGBA buffer inside wasm linear memory.
     * @returns {number}
     */
    get pixel_ptr() {
        const ret = wasm.engine_pixel_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Recent chemical reactions as a JSON array, newest first.
     * @returns {string}
     */
    reactions() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.engine_reactions(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Pushes the current state onto the undo stack. Called once per brush
     * stroke, not once per pointer move.
     */
    snapshot() {
        wasm.engine_snapshot(this.__wbg_ptr);
    }
    /**
     * Advances the simulation by one tick.
     */
    step() {
        wasm.engine_step(this.__wbg_ptr);
    }
    /**
     * Advances by `ticks` ticks (capped, so a tab that was asleep cannot hang).
     * @param {number} ticks
     */
    step_n(ticks) {
        wasm.engine_step_n(this.__wbg_ptr, ticks);
    }
    /**
     * Restores the previous snapshot. Returns whether anything was undone.
     * @returns {boolean}
     */
    undo() {
        const ret = wasm.engine_undo(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * World width in cells.
     * @returns {number}
     */
    get width() {
        const ret = wasm.engine_width(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) Engine.prototype[Symbol.dispose] = Engine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
    };
    return {
        __proto__: null,
        "./alkalab_bg.js": import0,
    };
}

const EngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_engine_free(ptr, 1));

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('alkalab.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
