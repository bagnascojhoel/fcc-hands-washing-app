var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src/components/ProgressBar.svelte generated by Svelte v3.44.2 */

    function create_fragment$6(ctx) {
    	let div1;
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let div0;
    	let div0_style_value;

    	return {
    		c() {
    			div1 = element("div");
    			span = element("span");
    			t0 = text(/*progress*/ ctx[0]);
    			t1 = text("%");
    			t2 = space();
    			div0 = element("div");
    			attr(span, "class", "progress-bar__value svelte-1ijpkx6");
    			attr(div0, "class", "progress-bar svelte-1ijpkx6");
    			attr(div0, "style", div0_style_value = `width: ${/*progress*/ ctx[0]}%;`);
    			attr(div1, "class", "progress-bar__container svelte-1ijpkx6");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, span);
    			append(span, t0);
    			append(span, t1);
    			append(div1, t2);
    			append(div1, div0);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*progress*/ 1) set_data(t0, /*progress*/ ctx[0]);

    			if (dirty & /*progress*/ 1 && div0_style_value !== (div0_style_value = `width: ${/*progress*/ ctx[0]}%;`)) {
    				attr(div0, "style", div0_style_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let progress;
    	let { value = 80 } = $$props;
    	let { total = 100 } = $$props;

    	$$self.$$set = $$props => {
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('total' in $$props) $$invalidate(2, total = $$props.total);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*total, value*/ 6) {
    			$$invalidate(0, progress = Math.floor(100 / total * value));
    		}
    	};

    	return [progress, value, total];
    }

    class ProgressBar extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$6, safe_not_equal, { value: 1, total: 2 });
    	}
    }

    /* src/components/Timer.svelte generated by Svelte v3.44.2 */

    function create_fragment$5(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let progressbar;
    	let t4;
    	let button;
    	let t5;
    	let current;
    	let mounted;
    	let dispose;

    	progressbar = new ProgressBar({
    			props: {
    				value: TOTAL_SECONDS - /*secondsLeft*/ ctx[0],
    				total: TOTAL_SECONDS
    			}
    		});

    	return {
    		c() {
    			h2 = element("h2");
    			t0 = text("There are ");
    			t1 = text(/*secondsLeft*/ ctx[0]);
    			t2 = text(" s left");
    			t3 = space();
    			create_component(progressbar.$$.fragment);
    			t4 = space();
    			button = element("button");
    			t5 = text("Start");
    			button.disabled = /*isRunning*/ ctx[1];
    			attr(button, "class", "button button--timer svelte-1qsuyux");
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			append(h2, t0);
    			append(h2, t1);
    			append(h2, t2);
    			insert(target, t3, anchor);
    			mount_component(progressbar, target, anchor);
    			insert(target, t4, anchor);
    			insert(target, button, anchor);
    			append(button, t5);
    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*startCountdown*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*secondsLeft*/ 1) set_data(t1, /*secondsLeft*/ ctx[0]);
    			const progressbar_changes = {};
    			if (dirty & /*secondsLeft*/ 1) progressbar_changes.value = TOTAL_SECONDS - /*secondsLeft*/ ctx[0];
    			progressbar.$set(progressbar_changes);

    			if (!current || dirty & /*isRunning*/ 2) {
    				button.disabled = /*isRunning*/ ctx[1];
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(progressbar.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(progressbar.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t3);
    			destroy_component(progressbar, detaching);
    			if (detaching) detach(t4);
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    const TOTAL_SECONDS = 3;

    function instance$3($$self, $$props, $$invalidate) {
    	let isRunning;
    	const dispatch = createEventDispatcher();
    	let secondsLeft = TOTAL_SECONDS;

    	function startCountdown() {
    		const interval = setInterval(
    			() => {
    				$$invalidate(0, secondsLeft--, secondsLeft);

    				if (secondsLeft === 0) {
    					clearInterval(interval);

    					setTimeout(
    						() => {
    							dispatch('end');
    							$$invalidate(0, secondsLeft = TOTAL_SECONDS);
    						},
    						1200
    					);
    				}
    			},
    			1000
    		);

    		dispatch('start');
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*secondsLeft*/ 1) {
    			$$invalidate(1, isRunning = secondsLeft < TOTAL_SECONDS);
    		}
    	};

    	return [secondsLeft, isRunning, startCountdown];
    }

    class Timer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$5, safe_not_equal, {});
    	}
    }

    /* src/components/HowTo.svelte generated by Svelte v3.44.2 */

    function create_fragment$4(ctx) {
    	let img;
    	let img_src_value;

    	return {
    		c() {
    			img = element("img");
    			attr(img, "id", "how-to");
    			if (!src_url_equal(img.src, img_src_value = "handwashing.png")) attr(img, "src", img_src_value);
    			attr(img, "alt", "How to wash hands");
    			attr(img, "class", "svelte-1q97l3c");
    		},
    		m(target, anchor) {
    			insert(target, img, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(img);
    		}
    	};
    }

    class HowTo extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src/components/Container.svelte generated by Svelte v3.44.2 */

    function create_fragment$3(ctx) {
    	let div1;
    	let div0;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			if (default_slot) default_slot.c();
    			attr(div0, "bp", "offset-3@md 9@md 12@sm offset-4@lg 6@lg offset-5@xl 4@xl");
    			attr(div1, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);

    			if (default_slot) {
    				default_slot.m(div0, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Container extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/components/Sources.svelte generated by Svelte v3.44.2 */

    function create_default_slot$1(ctx) {
    	let h3;
    	let t1;
    	let div;

    	return {
    		c() {
    			h3 = element("h3");
    			h3.textContent = "External Sources";
    			t1 = space();
    			div = element("div");

    			div.innerHTML = `<a href="https://www.unwater.org/app/uploads/2020/03/handwashing.png">Image</a> 
    <a href="https://freesound.org/people/muy2149972/sounds/586416/">Audio</a>`;

    			attr(h3, "class", "title svelte-1kmf0vo");
    			attr(div, "class", "horizontal-list svelte-1kmf0vo");
    		},
    		m(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(h3);
    			if (detaching) detach(t1);
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let container;
    	let current;

    	container = new Container({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(container.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(container, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const container_changes = {};

    			if (dirty & /*$$scope*/ 1) {
    				container_changes.$$scope = { dirty, ctx };
    			}

    			container.$set(container_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(container.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(container.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(container, detaching);
    		}
    	};
    }

    class Sources extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src/components/WaterRunningAudio.svelte generated by Svelte v3.44.2 */

    function create_fragment$1(ctx) {
    	let audio;

    	return {
    		c() {
    			audio = element("audio");
    			audio.innerHTML = `<source src="water-running-audio.m4a"/>`;
    		},
    		m(target, anchor) {
    			insert(target, audio, anchor);
    			/*audio_binding*/ ctx[3](audio);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(audio);
    			/*audio_binding*/ ctx[3](null);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let audioElement;

    	function play() {
    		audioElement.play();
    	}

    	function stop() {
    		audioElement.pause();
    	}

    	function audio_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			audioElement = $$value;
    			$$invalidate(0, audioElement);
    		});
    	}

    	return [audioElement, play, stop, audio_binding];
    }

    class WaterRunningAudio extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { play: 1, stop: 2 });
    	}

    	get play() {
    		return this.$$.ctx[1];
    	}

    	get stop() {
    		return this.$$.ctx[2];
    	}
    }

    /* src/App.svelte generated by Svelte v3.44.2 */

    function create_default_slot(ctx) {
    	let h1;
    	let t1;
    	let timer;
    	let t2;
    	let howto;
    	let t3;
    	let sources;
    	let t4;
    	let waterrunningaudio;
    	let current;
    	timer = new Timer({});
    	timer.$on("start", /*playAudio*/ ctx[1]);
    	timer.$on("end", /*stopAudio*/ ctx[2]);
    	howto = new HowTo({});
    	sources = new Sources({});
    	let waterrunningaudio_props = {};
    	waterrunningaudio = new WaterRunningAudio({ props: waterrunningaudio_props });
    	/*waterrunningaudio_binding*/ ctx[3](waterrunningaudio);

    	return {
    		c() {
    			h1 = element("h1");
    			h1.textContent = "Hand Washing App";
    			t1 = space();
    			create_component(timer.$$.fragment);
    			t2 = space();
    			create_component(howto.$$.fragment);
    			t3 = space();
    			create_component(sources.$$.fragment);
    			t4 = space();
    			create_component(waterrunningaudio.$$.fragment);
    			set_style(h1, "text-align", "center");
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    			insert(target, t1, anchor);
    			mount_component(timer, target, anchor);
    			insert(target, t2, anchor);
    			mount_component(howto, target, anchor);
    			insert(target, t3, anchor);
    			mount_component(sources, target, anchor);
    			insert(target, t4, anchor);
    			mount_component(waterrunningaudio, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const waterrunningaudio_changes = {};
    			waterrunningaudio.$set(waterrunningaudio_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(timer.$$.fragment, local);
    			transition_in(howto.$$.fragment, local);
    			transition_in(sources.$$.fragment, local);
    			transition_in(waterrunningaudio.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(timer.$$.fragment, local);
    			transition_out(howto.$$.fragment, local);
    			transition_out(sources.$$.fragment, local);
    			transition_out(waterrunningaudio.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			destroy_component(timer, detaching);
    			if (detaching) detach(t2);
    			destroy_component(howto, detaching);
    			if (detaching) detach(t3);
    			destroy_component(sources, detaching);
    			if (detaching) detach(t4);
    			/*waterrunningaudio_binding*/ ctx[3](null);
    			destroy_component(waterrunningaudio, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let container;
    	let current;

    	container = new Container({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(container.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(container, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const container_changes = {};

    			if (dirty & /*$$scope, waterRunningAudio*/ 17) {
    				container_changes.$$scope = { dirty, ctx };
    			}

    			container.$set(container_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(container.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(container.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(container, detaching);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let waterRunningAudio;

    	function playAudio() {
    		waterRunningAudio.play();
    	}

    	function stopAudio() {
    		waterRunningAudio.stop();
    	}

    	function waterrunningaudio_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			waterRunningAudio = $$value;
    			$$invalidate(0, waterRunningAudio);
    		});
    	}

    	return [waterRunningAudio, playAudio, stopAudio, waterrunningaudio_binding];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
