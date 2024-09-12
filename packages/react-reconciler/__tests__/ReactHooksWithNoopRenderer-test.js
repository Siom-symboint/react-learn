/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment node
 */

/* eslint-disable no-func-assign */

'use strict';

let React;
let textCache;
let readText;
let resolveText;
let ReactNoop;
let Scheduler;
let Suspense;
let useState;
let useReducer;
let useEffect;
let useInsertionEffect;
let useLayoutEffect;
let useCallback;
let useMemo;
let useRef;
let useImperativeHandle;
let useTransition;
let useDeferredValue;
let forwardRef;
let memo;
let act;
let ContinuousEventPriority;

describe('ReactHooksWithNoopRenderer', () => {
	beforeEach(() => {
		jest.resetModules();
		jest.useFakeTimers();

		React = require('react');
		ReactNoop = require('react-noop-renderer');
		Scheduler = require('scheduler');
		act = require('jest-react').act;
		useState = React.useState;
		// useReducer = React.useReducer;
		useEffect = React.useEffect;
		// useInsertionEffect = React.useInsertionEffect;
		// useLayoutEffect = React.useLayoutEffect;
		// useCallback = React.useCallback;
		// useMemo = React.useMemo;
		// useRef = React.useRef;
		// useImperativeHandle = React.useImperativeHandle;
		// forwardRef = React.forwardRef;
		// memo = React.memo;
		// useTransition = React.useTransition;
		// useDeferredValue = React.useDeferredValue;
		// Suspense = React.Suspense;
		// ContinuousEventPriority = require('react-reconciler/constants')
		//   .ContinuousEventPriority;

		textCache = new Map();

		readText = (text) => {
			const record = textCache.get(text);
			if (record !== undefined) {
				switch (record.status) {
					case 'pending':
						throw record.promise;
					case 'rejected':
						throw Error('Failed to load: ' + text);
					case 'resolved':
						return text;
				}
			} else {
				let ping;
				const promise = new Promise((resolve) => (ping = resolve));
				const newRecord = {
					status: 'pending',
					ping: ping,
					promise
				};
				textCache.set(text, newRecord);
				throw promise;
			}
		};

		resolveText = (text) => {
			const record = textCache.get(text);
			if (record !== undefined) {
				if (record.status === 'pending') {
					Scheduler.unstable_yieldValue(`Promise resolved [${text}]`);
					record.ping();
					record.ping = null;
					record.status = 'resolved';
					clearTimeout(record.promise._timer);
					record.promise = null;
				}
			} else {
				const newRecord = {
					ping: null,
					status: 'resolved',
					promise: null
				};
				textCache.set(text, newRecord);
			}
		};
	});

	function span(props) {
		return { type: 'span', children: [], props };
	}

	function Text(props) {
		Scheduler.unstable_yieldValue(props.text);
		return <span prop={props.text} />;
	}

	function AsyncText(props) {
		const text = props.text;
		try {
			readText(text);
			Scheduler.unstable_yieldValue(text);
			return <span prop={text} />;
		} catch (promise) {
			if (typeof promise.then === 'function') {
				Scheduler.unstable_yieldValue(`Suspend! [${text}]`);
				if (typeof props.ms === 'number' && promise._timer === undefined) {
					promise._timer = setTimeout(() => {
						resolveText(text);
					}, props.ms);
				}
			} else {
				Scheduler.unstable_yieldValue(`Error! [${text}]`);
			}
			throw promise;
		}
	}

	function advanceTimers(ms) {
		// Note: This advances Jest's virtual time but not React's. Use
		// ReactNoop.expire for that.
		if (typeof ms !== 'number') {
			throw new Error('Must specify ms');
		}
		jest.advanceTimersByTime(ms);
		// Wait until the end of the current tick
		// We cannot use a timer since we're faking them
		return Promise.resolve().then(() => {});
	}

	it('throws when called outside the render phase', () => {
		expect(() => {
			expect(() => useState(0)).toThrow(
				"Cannot read property 'useState' of null"
			);
		}).toThrow('Hook只能在函数组件中执行');
	});

	describe('useEffect', () => {
		it('simple mount and update', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Passive effect [${props.count}]`);
				});
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
				// Effects are deferred until after the commit
				expect(Scheduler).toFlushAndYield(['Passive effect [0]']);
			});

			act(() => {
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
				// Effects are deferred until after the commit
				expect(Scheduler).toFlushAndYield(['Passive effect [1]']);
			});
		});

		it('flushes passive effects even with sibling deletions', () => {
			function LayoutEffect(props) {
				useLayoutEffect(() => {
					Scheduler.unstable_yieldValue(`Layout effect`);
				});
				return <Text text="Layout" />;
			}
			function PassiveEffect(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Passive effect`);
				}, []);
				return <Text text="Passive" />;
			}
			const passive = <PassiveEffect key="p" />;
			act(() => {
				ReactNoop.render([<LayoutEffect key="l" />, passive]);
				expect(Scheduler).toFlushAndYieldThrough([
					'Layout',
					'Passive',
					'Layout effect'
				]);
				expect(ReactNoop.getChildren()).toEqual([
					span('Layout'),
					span('Passive')
				]);
				// Destroying the first child shouldn't prevent the passive effect from
				// being executed
				ReactNoop.render([passive]);
				expect(Scheduler).toFlushAndYield(['Passive effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Passive')]);
			});
			// exiting act calls flushPassiveEffects(), but there are none left to flush.
			expect(Scheduler).toHaveYielded([]);
		});

		it('flushes passive effects even if siblings schedule an update', () => {
			function PassiveEffect(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue('Passive effect');
				});
				return <Text text="Passive" />;
			}
			function LayoutEffect(props) {
				const [count, setCount] = useState(0);
				useLayoutEffect(() => {
					// Scheduling work shouldn't interfere with the queued passive effect
					if (count === 0) {
						setCount(1);
					}
					Scheduler.unstable_yieldValue('Layout effect ' + count);
				});
				return <Text text="Layout" />;
			}

			ReactNoop.render([<PassiveEffect key="p" />, <LayoutEffect key="l" />]);

			act(() => {
				expect(Scheduler).toFlushAndYield([
					'Passive',
					'Layout',
					'Layout effect 0',
					'Passive effect',
					'Layout',
					'Layout effect 1'
				]);
			});

			expect(ReactNoop.getChildren()).toEqual([
				span('Passive'),
				span('Layout')
			]);
		});

		it('flushes passive effects even if siblings schedule a new root', () => {
			function PassiveEffect(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue('Passive effect');
				}, []);
				return <Text text="Passive" />;
			}
			function LayoutEffect(props) {
				useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('Layout effect');
					// Scheduling work shouldn't interfere with the queued passive effect
					ReactNoop.renderToRootWithID(<Text text="New Root" />, 'root2');
				});
				return <Text text="Layout" />;
			}
			act(() => {
				ReactNoop.render([<PassiveEffect key="p" />, <LayoutEffect key="l" />]);
				expect(Scheduler).toFlushAndYield([
					'Passive',
					'Layout',
					'Layout effect',
					'Passive effect',
					'New Root'
				]);
				expect(ReactNoop.getChildren()).toEqual([
					span('Passive'),
					span('Layout')
				]);
			});
		});

		it(
			'flushes effects serially by flushing old effects before flushing ' +
				"new ones, if they haven't already fired",
			() => {
				function getCommittedText() {
					const children = ReactNoop.getChildren();
					if (children === null) {
						return null;
					}
					return children[0].prop;
				}

				function Counter(props) {
					useEffect(() => {
						Scheduler.unstable_yieldValue(
							`Committed state when effect was fired: ${getCommittedText()}`
						);
					});
					return <Text text={props.count} />;
				}
				act(() => {
					ReactNoop.render(<Counter count={0} />, () =>
						Scheduler.unstable_yieldValue('Sync effect')
					);
					expect(Scheduler).toFlushAndYieldThrough([0, 'Sync effect']);
					expect(ReactNoop.getChildren()).toEqual([span(0)]);
					// Before the effects have a chance to flush, schedule another update
					ReactNoop.render(<Counter count={1} />, () =>
						Scheduler.unstable_yieldValue('Sync effect')
					);
					expect(Scheduler).toFlushAndYieldThrough([
						// The previous effect flushes before the reconciliation
						'Committed state when effect was fired: 0',
						1,
						'Sync effect'
					]);
					expect(ReactNoop.getChildren()).toEqual([span(1)]);
				});

				expect(Scheduler).toHaveYielded([
					'Committed state when effect was fired: 1'
				]);
			}
		);

		it('defers passive effect destroy functions during unmount', () => {
			function Child({ bar, foo }) {
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('passive bar create');
					return () => {
						Scheduler.unstable_yieldValue('passive bar destroy');
					};
				}, [bar]);
				React.useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('layout bar create');
					return () => {
						Scheduler.unstable_yieldValue('layout bar destroy');
					};
				}, [bar]);
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('passive foo create');
					return () => {
						Scheduler.unstable_yieldValue('passive foo destroy');
					};
				}, [foo]);
				React.useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('layout foo create');
					return () => {
						Scheduler.unstable_yieldValue('layout foo destroy');
					};
				}, [foo]);
				Scheduler.unstable_yieldValue('render');
				return null;
			}

			act(() => {
				ReactNoop.render(<Child bar={1} foo={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'render',
					'layout bar create',
					'layout foo create',
					'Sync effect'
				]);
				// Effects are deferred until after the commit
				expect(Scheduler).toFlushAndYield([
					'passive bar create',
					'passive foo create'
				]);
			});

			// This update exists to test an internal implementation detail:
			// Effects without updating dependencies lose their layout/passive tag during an update.
			act(() => {
				ReactNoop.render(<Child bar={1} foo={2} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'render',
					'layout foo destroy',
					'layout foo create',
					'Sync effect'
				]);
				// Effects are deferred until after the commit
				expect(Scheduler).toFlushAndYield([
					'passive foo destroy',
					'passive foo create'
				]);
			});

			// Unmount the component and verify that passive destroy functions are deferred until post-commit.
			act(() => {
				ReactNoop.render(null, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'layout bar destroy',
					'layout foo destroy',
					'Sync effect'
				]);
				// Effects are deferred until after the commit
				expect(Scheduler).toFlushAndYield([
					'passive bar destroy',
					'passive foo destroy'
				]);
			});
		});

		it('does not warn about state updates for unmounted components with pending passive unmounts', () => {
			let completePendingRequest = null;
			function Component() {
				Scheduler.unstable_yieldValue('Component');
				const [didLoad, setDidLoad] = React.useState(false);
				React.useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('layout create');
					return () => {
						Scheduler.unstable_yieldValue('layout destroy');
					};
				}, []);
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('passive create');
					// Mimic an XHR request with a complete handler that updates state.
					completePendingRequest = () => setDidLoad(true);
					return () => {
						Scheduler.unstable_yieldValue('passive destroy');
					};
				}, []);
				return didLoad;
			}

			act(() => {
				ReactNoop.renderToRootWithID(<Component />, 'root', () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'Component',
					'layout create',
					'Sync effect'
				]);
				ReactNoop.flushPassiveEffects();
				expect(Scheduler).toHaveYielded(['passive create']);

				// Unmount but don't process pending passive destroy function
				ReactNoop.unmountRootWithID('root');
				expect(Scheduler).toFlushAndYieldThrough(['layout destroy']);

				// Simulate an XHR completing, which will cause a state update-
				// but should not log a warning.
				completePendingRequest();

				ReactNoop.flushPassiveEffects();
				expect(Scheduler).toHaveYielded(['passive destroy']);
			});
		});

		// it('does not warn about state updates for unmounted components with pending passive unmounts for alternates', () => {
		//   let setParentState = null;
		//   const setChildStates = [];

		//   function Parent() {
		//     const [state, setState] = useState(true);
		//     setParentState = setState;
		//     Scheduler.unstable_yieldValue(`Parent ${state} render`);
		//     useLayoutEffect(() => {
		//       Scheduler.unstable_yieldValue(`Parent ${state} commit`);
		//     });
		//     if (state) {
		//       return (
		//         <>
		//           <Child label="one" />
		//           <Child label="two" />
		//         </>
		//       );
		//     } else {
		//       return null;
		//     }
		//   }

		//   function Child({label}) {
		//     const [state, setState] = useState(0);
		//     useLayoutEffect(() => {
		//       Scheduler.unstable_yieldValue(`Child ${label} commit`);
		//     });
		//     useEffect(() => {
		//       setChildStates.push(setState);
		//       Scheduler.unstable_yieldValue(`Child ${label} passive create`);
		//       return () => {
		//         Scheduler.unstable_yieldValue(`Child ${label} passive destroy`);
		//       };
		//     }, []);
		//     Scheduler.unstable_yieldValue(`Child ${label} render`);
		//     return state;
		//   }

		//   // Schedule debounced state update for child (prob a no-op for this test)
		//   // later tick: schedule unmount for parent
		//   // start process unmount (but don't flush passive effectS)
		//   // State update on child
		//   act(() => {
		//     ReactNoop.render(<Parent />);
		//     expect(Scheduler).toFlushAndYieldThrough([
		//       'Parent true render',
		//       'Child one render',
		//       'Child two render',
		//       'Child one commit',
		//       'Child two commit',
		//       'Parent true commit',
		//       'Child one passive create',
		//       'Child two passive create',
		//     ]);

		//     // Update children.
		//     setChildStates.forEach(setChildState => setChildState(1));
		//     expect(Scheduler).toFlushAndYieldThrough([
		//       'Child one render',
		//       'Child two render',
		//       'Child one commit',
		//       'Child two commit',
		//     ]);

		//     // Schedule another update for children, and partially process it.
		//     if (gate(flags => flags.enableSyncDefaultUpdates)) {
		//       React.startTransition(() => {
		//         setChildStates.forEach(setChildState => setChildState(2));
		//       });
		//     } else {
		//       setChildStates.forEach(setChildState => setChildState(2));
		//     }
		//     expect(Scheduler).toFlushAndYieldThrough(['Child one render']);

		//     // Schedule unmount for the parent that unmounts children with pending update.
		//     ReactNoop.unstable_runWithPriority(ContinuousEventPriority, () => {
		//       setParentState(false);
		//     });
		//     expect(Scheduler).toFlushUntilNextPaint([
		//       'Parent false render',
		//       'Parent false commit',
		//     ]);

		//     // Schedule updates for children too (which should be ignored)
		//     setChildStates.forEach(setChildState => setChildState(2));
		//     expect(Scheduler).toFlushAndYield([
		//       'Child one passive destroy',
		//       'Child two passive destroy',
		//     ]);
		//   });
		// });

		it('does not warn about state updates for unmounted components with no pending passive unmounts', () => {
			let completePendingRequest = null;
			function Component() {
				Scheduler.unstable_yieldValue('Component');
				const [didLoad, setDidLoad] = React.useState(false);
				React.useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('layout create');
					// Mimic an XHR request with a complete handler that updates state.
					completePendingRequest = () => setDidLoad(true);
					return () => {
						Scheduler.unstable_yieldValue('layout destroy');
					};
				}, []);
				return didLoad;
			}

			act(() => {
				ReactNoop.renderToRootWithID(<Component />, 'root', () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'Component',
					'layout create',
					'Sync effect'
				]);

				// Unmount but don't process pending passive destroy function
				ReactNoop.unmountRootWithID('root');
				expect(Scheduler).toFlushAndYieldThrough(['layout destroy']);

				// Simulate an XHR completing.
				completePendingRequest();
			});
		});

		it('does not warn if there are pending passive unmount effects but not for the current fiber', () => {
			let completePendingRequest = null;
			function ComponentWithXHR() {
				Scheduler.unstable_yieldValue('Component');
				const [didLoad, setDidLoad] = React.useState(false);
				React.useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('a:layout create');
					return () => {
						Scheduler.unstable_yieldValue('a:layout destroy');
					};
				}, []);
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('a:passive create');
					// Mimic an XHR request with a complete handler that updates state.
					completePendingRequest = () => setDidLoad(true);
				}, []);
				return didLoad;
			}

			function ComponentWithPendingPassiveUnmount() {
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('b:passive create');
					return () => {
						Scheduler.unstable_yieldValue('b:passive destroy');
					};
				}, []);
				return null;
			}

			act(() => {
				ReactNoop.renderToRootWithID(
					<>
						<ComponentWithXHR />
						<ComponentWithPendingPassiveUnmount />
					</>,
					'root',
					() => Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'Component',
					'a:layout create',
					'Sync effect'
				]);
				ReactNoop.flushPassiveEffects();
				expect(Scheduler).toHaveYielded([
					'a:passive create',
					'b:passive create'
				]);

				// Unmount but don't process pending passive destroy function
				ReactNoop.unmountRootWithID('root');
				expect(Scheduler).toFlushAndYieldThrough(['a:layout destroy']);

				// Simulate an XHR completing in the component without a pending passive effect..
				completePendingRequest();
			});
		});

		it('does not warn if there are updates after pending passive unmount effects have been flushed', () => {
			let updaterFunction;

			function Component() {
				Scheduler.unstable_yieldValue('Component');
				const [state, setState] = React.useState(false);
				updaterFunction = setState;
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('passive create');
					return () => {
						Scheduler.unstable_yieldValue('passive destroy');
					};
				}, []);
				return state;
			}

			act(() => {
				ReactNoop.renderToRootWithID(<Component />, 'root', () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
			});
			expect(Scheduler).toHaveYielded([
				'Component',
				'Sync effect',
				'passive create'
			]);

			ReactNoop.unmountRootWithID('root');
			expect(Scheduler).toFlushAndYield(['passive destroy']);

			act(() => {
				updaterFunction(true);
			});
		});

		it('does not show a warning when a component updates its own state from within passive unmount function', () => {
			function Component() {
				Scheduler.unstable_yieldValue('Component');
				const [didLoad, setDidLoad] = React.useState(false);
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('passive create');
					return () => {
						setDidLoad(true);
						Scheduler.unstable_yieldValue('passive destroy');
					};
				}, []);
				return didLoad;
			}

			act(() => {
				ReactNoop.renderToRootWithID(<Component />, 'root', () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'Component',
					'Sync effect',
					'passive create'
				]);

				// Unmount but don't process pending passive destroy function
				ReactNoop.unmountRootWithID('root');
				expect(Scheduler).toFlushAndYield(['passive destroy']);
			});
		});

		it('does not show a warning when a component updates a child state from within passive unmount function', () => {
			function Parent() {
				Scheduler.unstable_yieldValue('Parent');
				const updaterRef = useRef(null);
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('Parent passive create');
					return () => {
						updaterRef.current(true);
						Scheduler.unstable_yieldValue('Parent passive destroy');
					};
				}, []);
				return <Child updaterRef={updaterRef} />;
			}

			function Child({ updaterRef }) {
				Scheduler.unstable_yieldValue('Child');
				const [state, setState] = React.useState(false);
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('Child passive create');
					updaterRef.current = setState;
				}, []);
				return state;
			}

			act(() => {
				ReactNoop.renderToRootWithID(<Parent />, 'root');
				expect(Scheduler).toFlushAndYieldThrough([
					'Parent',
					'Child',
					'Child passive create',
					'Parent passive create'
				]);

				// Unmount but don't process pending passive destroy function
				ReactNoop.unmountRootWithID('root');
				expect(Scheduler).toFlushAndYield(['Parent passive destroy']);
			});
		});

		it('does not show a warning when a component updates a parents state from within passive unmount function', () => {
			function Parent() {
				const [state, setState] = React.useState(false);
				Scheduler.unstable_yieldValue('Parent');
				return <Child setState={setState} state={state} />;
			}

			function Child({ setState, state }) {
				Scheduler.unstable_yieldValue('Child');
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('Child passive create');
					return () => {
						Scheduler.unstable_yieldValue('Child passive destroy');
						setState(true);
					};
				}, []);
				return state;
			}

			act(() => {
				ReactNoop.renderToRootWithID(<Parent />, 'root');
				expect(Scheduler).toFlushAndYieldThrough([
					'Parent',
					'Child',
					'Child passive create'
				]);

				// Unmount but don't process pending passive destroy function
				ReactNoop.unmountRootWithID('root');
				expect(Scheduler).toFlushAndYield(['Child passive destroy']);
			});
		});

		it('updates have async priority', () => {
			function Counter(props) {
				const [count, updateCount] = useState('(empty)');
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Schedule update [${props.count}]`);
					updateCount(props.count);
				}, [props.count]);
				return <Text text={'Count: ' + count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'Count: (empty)',
					'Sync effect'
				]);
				expect(ReactNoop.getChildren()).toEqual([span('Count: (empty)')]);
				ReactNoop.flushPassiveEffects();
				expect(Scheduler).toHaveYielded(['Schedule update [0]']);
				expect(Scheduler).toFlushAndYield(['Count: 0']);
			});

			act(() => {
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
				ReactNoop.flushPassiveEffects();
				expect(Scheduler).toHaveYielded(['Schedule update [1]']);
				expect(Scheduler).toFlushAndYield(['Count: 1']);
			});
		});

		it('updates have async priority even if effects are flushed early', () => {
			function Counter(props) {
				const [count, updateCount] = useState('(empty)');
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Schedule update [${props.count}]`);
					updateCount(props.count);
				}, [props.count]);
				return <Text text={'Count: ' + count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough([
					'Count: (empty)',
					'Sync effect'
				]);
				expect(ReactNoop.getChildren()).toEqual([span('Count: (empty)')]);

				// Rendering again should flush the previous commit's effects
				if (gate((flags) => flags.enableSyncDefaultUpdates)) {
					React.startTransition(() => {
						ReactNoop.render(<Counter count={1} />, () =>
							Scheduler.unstable_yieldValue('Sync effect')
						);
					});
				} else {
					ReactNoop.render(<Counter count={1} />, () =>
						Scheduler.unstable_yieldValue('Sync effect')
					);
				}

				expect(Scheduler).toFlushAndYieldThrough([
					'Schedule update [0]',
					'Count: 0'
				]);

				if (gate((flags) => flags.enableSyncDefaultUpdates)) {
					expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
					expect(Scheduler).toFlushAndYieldThrough([
						'Count: 0',
						'Sync effect',
						'Schedule update [1]',
						'Count: 1'
					]);
				} else {
					expect(ReactNoop.getChildren()).toEqual([span('Count: (empty)')]);
					expect(Scheduler).toFlushAndYieldThrough(['Sync effect']);
					expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);

					ReactNoop.flushPassiveEffects();
					expect(Scheduler).toHaveYielded(['Schedule update [1]']);
					expect(Scheduler).toFlushAndYield(['Count: 1']);
				}

				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
			});
		});

		it('does not flush non-discrete passive effects when flushing sync', () => {
			let _updateCount;
			function Counter(props) {
				const [count, updateCount] = useState(0);
				_updateCount = updateCount;
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Will set count to 1`);
					updateCount(1);
				}, []);
				return <Text text={'Count: ' + count} />;
			}

			ReactNoop.render(<Counter count={0} />, () =>
				Scheduler.unstable_yieldValue('Sync effect')
			);
			expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
			expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			// A flush sync doesn't cause the passive effects to fire.
			// So we haven't added the other update yet.
			act(() => {
				ReactNoop.flushSync(() => {
					_updateCount(2);
				});
			});

			// As a result we, somewhat surprisingly, commit them in the opposite order.
			// This should be fine because any non-discrete set of work doesn't guarantee order
			// and easily could've happened slightly later too.
			expect(Scheduler).toHaveYielded([
				'Will set count to 1',
				'Count: 2',
				'Count: 1'
			]);

			expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
		});

		it(
			'in legacy mode, useEffect is deferred and updates finish synchronously ' +
				'(in a single batch)',
			async () => {
				function Counter(props) {
					const [count, updateCount] = useState('(empty)');
					useEffect(() => {
						// Update multiple times. These should all be batched together in
						// a single render.
						updateCount(props.count);
						updateCount(props.count);
						updateCount(props.count);
						updateCount(props.count);
						updateCount(props.count);
						updateCount(props.count);
					}, [props.count]);
					return <Text text={'Count: ' + count} />;
				}
				await act(async () => {
					ReactNoop.flushSync(() => {
						ReactNoop.renderLegacySyncRoot(<Counter count={0} />);
					});

					// Even in legacy mode, effects are deferred until after paint
					expect(Scheduler).toHaveYielded(['Count: (empty)']);
					expect(ReactNoop.getChildren()).toEqual([span('Count: (empty)')]);
				});

				// effects get forced on exiting act()
				// There were multiple updates, but there should only be a
				// single render
				expect(Scheduler).toHaveYielded(['Count: 0']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			}
		);

		it('flushSync is not allowed', () => {
			function Counter(props) {
				const [count, updateCount] = useState('(empty)');
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Schedule update [${props.count}]`);
					ReactNoop.flushSync(() => {
						updateCount(props.count);
					});
					// This shouldn't flush synchronously.
					expect(ReactNoop.getChildren()).not.toEqual([
						span('Count: ' + props.count)
					]);
				}, [props.count]);
				return <Text text={'Count: ' + count} />;
			}
			expect(() =>
				act(() => {
					ReactNoop.render(<Counter count={0} />, () =>
						Scheduler.unstable_yieldValue('Sync effect')
					);
					expect(Scheduler).toFlushAndYieldThrough([
						'Count: (empty)',
						'Sync effect'
					]);
					expect(ReactNoop.getChildren()).toEqual([span('Count: (empty)')]);
				})
			).toErrorDev('flushSync was called from inside a lifecycle method');
			expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
		});

		it('unmounts previous effect', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Did create [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Did destroy [${props.count}]`);
					};
				});
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			});

			expect(Scheduler).toHaveYielded(['Did create [0]']);

			act(() => {
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
			});

			expect(Scheduler).toHaveYielded(['Did destroy [0]', 'Did create [1]']);
		});

		it('unmounts on deletion', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Did create [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Did destroy [${props.count}]`);
					};
				});
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			});

			expect(Scheduler).toHaveYielded(['Did create [0]']);

			ReactNoop.render(null);
			expect(Scheduler).toFlushAndYield(['Did destroy [0]']);
			expect(ReactNoop.getChildren()).toEqual([]);
		});

		it('unmounts on deletion after skipped effect', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Did create [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Did destroy [${props.count}]`);
					};
				}, []);
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			});

			expect(Scheduler).toHaveYielded(['Did create [0]']);

			act(() => {
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
			});

			expect(Scheduler).toHaveYielded([]);

			ReactNoop.render(null);
			expect(Scheduler).toFlushAndYield(['Did destroy [0]']);
			expect(ReactNoop.getChildren()).toEqual([]);
		});

		it('always fires effects if no dependencies are provided', () => {
			function effect() {
				Scheduler.unstable_yieldValue(`Did create`);
				return () => {
					Scheduler.unstable_yieldValue(`Did destroy`);
				};
			}
			function Counter(props) {
				useEffect(effect);
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			});

			expect(Scheduler).toHaveYielded(['Did create']);

			act(() => {
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
			});

			expect(Scheduler).toHaveYielded(['Did destroy', 'Did create']);

			ReactNoop.render(null);
			expect(Scheduler).toFlushAndYield(['Did destroy']);
			expect(ReactNoop.getChildren()).toEqual([]);
		});

		it('skips effect if inputs have not changed', () => {
			function Counter(props) {
				const text = `${props.label}: ${props.count}`;
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Did create [${text}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Did destroy [${text}]`);
					};
				}, [props.label, props.count]);
				return <Text text={text} />;
			}
			act(() => {
				ReactNoop.render(<Counter label="Count" count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
			});

			expect(Scheduler).toHaveYielded(['Did create [Count: 0]']);
			expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);

			act(() => {
				ReactNoop.render(<Counter label="Count" count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				// Count changed
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
			});

			expect(Scheduler).toHaveYielded([
				'Did destroy [Count: 0]',
				'Did create [Count: 1]'
			]);

			act(() => {
				ReactNoop.render(<Counter label="Count" count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				// Nothing changed, so no effect should have fired
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
			});

			expect(Scheduler).toHaveYielded([]);
			expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);

			act(() => {
				ReactNoop.render(<Counter label="Total" count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				// Label changed
				expect(Scheduler).toFlushAndYieldThrough(['Total: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Total: 1')]);
			});

			expect(Scheduler).toHaveYielded([
				'Did destroy [Count: 1]',
				'Did create [Total: 1]'
			]);
		});

		it('multiple effects', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Did commit 1 [${props.count}]`);
				});
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Did commit 2 [${props.count}]`);
				});
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			});

			expect(Scheduler).toHaveYielded(['Did commit 1 [0]', 'Did commit 2 [0]']);

			act(() => {
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
			});
			expect(Scheduler).toHaveYielded(['Did commit 1 [1]', 'Did commit 2 [1]']);
		});

		it('unmounts all previous effects before creating any new ones', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Mount A [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount A [${props.count}]`);
					};
				});
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Mount B [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount B [${props.count}]`);
					};
				});
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
			});

			expect(Scheduler).toHaveYielded(['Mount A [0]', 'Mount B [0]']);

			act(() => {
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
			});
			expect(Scheduler).toHaveYielded([
				'Unmount A [0]',
				'Unmount B [0]',
				'Mount A [1]',
				'Mount B [1]'
			]);
		});

		it('unmounts all previous effects between siblings before creating any new ones', () => {
			function Counter({ count, label }) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Mount ${label} [${count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount ${label} [${count}]`);
					};
				});
				return <Text text={`${label} ${count}`} />;
			}
			act(() => {
				ReactNoop.render(
					<>
						<Counter label="A" count={0} />
						<Counter label="B" count={0} />
					</>,
					() => Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['A 0', 'B 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('A 0'), span('B 0')]);
			});

			expect(Scheduler).toHaveYielded(['Mount A [0]', 'Mount B [0]']);

			act(() => {
				ReactNoop.render(
					<>
						<Counter label="A" count={1} />
						<Counter label="B" count={1} />
					</>,
					() => Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['A 1', 'B 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('A 1'), span('B 1')]);
			});
			expect(Scheduler).toHaveYielded([
				'Unmount A [0]',
				'Unmount B [0]',
				'Mount A [1]',
				'Mount B [1]'
			]);

			act(() => {
				ReactNoop.render(
					<>
						<Counter label="B" count={2} />
						<Counter label="C" count={0} />
					</>,
					() => Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['B 2', 'C 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('B 2'), span('C 0')]);
			});
			expect(Scheduler).toHaveYielded([
				'Unmount A [1]',
				'Unmount B [1]',
				'Mount B [2]',
				'Mount C [0]'
			]);
		});

		it('handles errors in create on mount', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Mount A [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount A [${props.count}]`);
					};
				});
				useEffect(() => {
					Scheduler.unstable_yieldValue('Oops!');
					throw new Error('Oops!');
					// eslint-disable-next-line no-unreachable
					Scheduler.unstable_yieldValue(`Mount B [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount B [${props.count}]`);
					};
				});
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
				expect(() => ReactNoop.flushPassiveEffects()).toThrow('Oops');
			});

			expect(Scheduler).toHaveYielded([
				'Mount A [0]',
				'Oops!',
				// Clean up effect A. There's no effect B to clean-up, because it
				// never mounted.
				'Unmount A [0]'
			]);
			expect(ReactNoop.getChildren()).toEqual([]);
		});

		it('handles errors in create on update', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Mount A [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount A [${props.count}]`);
					};
				});
				useEffect(() => {
					if (props.count === 1) {
						Scheduler.unstable_yieldValue('Oops!');
						throw new Error('Oops!');
					}
					Scheduler.unstable_yieldValue(`Mount B [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount B [${props.count}]`);
					};
				});
				return <Text text={'Count: ' + props.count} />;
			}
			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
				ReactNoop.flushPassiveEffects();
				expect(Scheduler).toHaveYielded(['Mount A [0]', 'Mount B [0]']);
			});

			act(() => {
				// This update will trigger an error
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
				expect(() => ReactNoop.flushPassiveEffects()).toThrow('Oops');
				expect(Scheduler).toHaveYielded([
					'Unmount A [0]',
					'Unmount B [0]',
					'Mount A [1]',
					'Oops!'
				]);
				expect(ReactNoop.getChildren()).toEqual([]);
			});
			expect(Scheduler).toHaveYielded([
				// Clean up effect A runs passively on unmount.
				// There's no effect B to clean-up, because it never mounted.
				'Unmount A [1]'
			]);
		});

		it('handles errors in destroy on update', () => {
			function Counter(props) {
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Mount A [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue('Oops!');
						if (props.count === 0) {
							throw new Error('Oops!');
						}
					};
				});
				useEffect(() => {
					Scheduler.unstable_yieldValue(`Mount B [${props.count}]`);
					return () => {
						Scheduler.unstable_yieldValue(`Unmount B [${props.count}]`);
					};
				});
				return <Text text={'Count: ' + props.count} />;
			}

			act(() => {
				ReactNoop.render(<Counter count={0} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 0', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);
				ReactNoop.flushPassiveEffects();
				expect(Scheduler).toHaveYielded(['Mount A [0]', 'Mount B [0]']);
			});

			act(() => {
				// This update will trigger an error during passive effect unmount
				ReactNoop.render(<Counter count={1} />, () =>
					Scheduler.unstable_yieldValue('Sync effect')
				);
				expect(Scheduler).toFlushAndYieldThrough(['Count: 1', 'Sync effect']);
				expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);
				expect(() => ReactNoop.flushPassiveEffects()).toThrow('Oops');

				// This branch enables a feature flag that flushes all passive destroys in a
				// separate pass before flushing any passive creates.
				// A result of this two-pass flush is that an error thrown from unmount does
				// not block the subsequent create functions from being run.
				expect(Scheduler).toHaveYielded([
					'Oops!',
					'Unmount B [0]',
					'Mount A [1]',
					'Mount B [1]'
				]);
			});

			// <Counter> gets unmounted because an error is thrown above.
			// The remaining destroy functions are run later on unmount, since they're passive.
			// In this case, one of them throws again (because of how the test is written).
			expect(Scheduler).toHaveYielded(['Oops!', 'Unmount B [1]']);
			expect(ReactNoop.getChildren()).toEqual([]);
		});

		it('works with memo', () => {
			function Counter({ count }) {
				useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('Mount: ' + count);
					return () => Scheduler.unstable_yieldValue('Unmount: ' + count);
				});
				return <Text text={'Count: ' + count} />;
			}
			Counter = memo(Counter);

			ReactNoop.render(<Counter count={0} />, () =>
				Scheduler.unstable_yieldValue('Sync effect')
			);
			expect(Scheduler).toFlushAndYieldThrough([
				'Count: 0',
				'Mount: 0',
				'Sync effect'
			]);
			expect(ReactNoop.getChildren()).toEqual([span('Count: 0')]);

			ReactNoop.render(<Counter count={1} />, () =>
				Scheduler.unstable_yieldValue('Sync effect')
			);
			expect(Scheduler).toFlushAndYieldThrough([
				'Count: 1',
				'Unmount: 0',
				'Mount: 1',
				'Sync effect'
			]);
			expect(ReactNoop.getChildren()).toEqual([span('Count: 1')]);

			ReactNoop.render(null);
			expect(Scheduler).toFlushAndYieldThrough(['Unmount: 1']);
			expect(ReactNoop.getChildren()).toEqual([]);
		});

		describe('errors thrown in passive destroy function within unmounted trees', () => {
			let BrokenUseEffectCleanup;
			let ErrorBoundary;
			let LogOnlyErrorBoundary;

			beforeEach(() => {
				BrokenUseEffectCleanup = function () {
					useEffect(() => {
						Scheduler.unstable_yieldValue('BrokenUseEffectCleanup useEffect');
						return () => {
							Scheduler.unstable_yieldValue(
								'BrokenUseEffectCleanup useEffect destroy'
							);
							throw new Error('Expected error');
						};
					}, []);

					return 'inner child';
				};

				ErrorBoundary = class extends React.Component {
					state = { error: null };
					static getDerivedStateFromError(error) {
						Scheduler.unstable_yieldValue(
							`ErrorBoundary static getDerivedStateFromError`
						);
						return { error };
					}
					componentDidCatch(error, info) {
						Scheduler.unstable_yieldValue(`ErrorBoundary componentDidCatch`);
					}
					render() {
						if (this.state.error) {
							Scheduler.unstable_yieldValue('ErrorBoundary render error');
							return <span prop="ErrorBoundary fallback" />;
						}
						Scheduler.unstable_yieldValue('ErrorBoundary render success');
						return this.props.children || null;
					}
				};

				LogOnlyErrorBoundary = class extends React.Component {
					componentDidCatch(error, info) {
						Scheduler.unstable_yieldValue(
							`LogOnlyErrorBoundary componentDidCatch`
						);
					}
					render() {
						Scheduler.unstable_yieldValue(`LogOnlyErrorBoundary render`);
						return this.props.children || null;
					}
				};
			});

			// @gate skipUnmountedBoundaries
			it('should use the nearest still-mounted boundary if there are no unmounted boundaries', () => {
				act(() => {
					ReactNoop.render(
						<LogOnlyErrorBoundary>
							<BrokenUseEffectCleanup />
						</LogOnlyErrorBoundary>
					);
				});

				expect(Scheduler).toHaveYielded([
					'LogOnlyErrorBoundary render',
					'BrokenUseEffectCleanup useEffect'
				]);

				act(() => {
					ReactNoop.render(<LogOnlyErrorBoundary />);
				});

				expect(Scheduler).toHaveYielded([
					'LogOnlyErrorBoundary render',
					'BrokenUseEffectCleanup useEffect destroy',
					'LogOnlyErrorBoundary componentDidCatch'
				]);
			});

			// @gate skipUnmountedBoundaries
			it('should skip unmounted boundaries and use the nearest still-mounted boundary', () => {
				function Conditional({ showChildren }) {
					if (showChildren) {
						return (
							<ErrorBoundary>
								<BrokenUseEffectCleanup />
							</ErrorBoundary>
						);
					} else {
						return null;
					}
				}

				act(() => {
					ReactNoop.render(
						<LogOnlyErrorBoundary>
							<Conditional showChildren={true} />
						</LogOnlyErrorBoundary>
					);
				});

				expect(Scheduler).toHaveYielded([
					'LogOnlyErrorBoundary render',
					'ErrorBoundary render success',
					'BrokenUseEffectCleanup useEffect'
				]);

				act(() => {
					ReactNoop.render(
						<LogOnlyErrorBoundary>
							<Conditional showChildren={false} />
						</LogOnlyErrorBoundary>
					);
				});

				expect(Scheduler).toHaveYielded([
					'LogOnlyErrorBoundary render',
					'BrokenUseEffectCleanup useEffect destroy',
					'LogOnlyErrorBoundary componentDidCatch'
				]);
			});

			// @gate skipUnmountedBoundaries
			it('should call getDerivedStateFromError in the nearest still-mounted boundary', () => {
				function Conditional({ showChildren }) {
					if (showChildren) {
						return <BrokenUseEffectCleanup />;
					} else {
						return null;
					}
				}

				act(() => {
					ReactNoop.render(
						<ErrorBoundary>
							<Conditional showChildren={true} />
						</ErrorBoundary>
					);
				});

				expect(Scheduler).toHaveYielded([
					'ErrorBoundary render success',
					'BrokenUseEffectCleanup useEffect'
				]);

				act(() => {
					ReactNoop.render(
						<ErrorBoundary>
							<Conditional showChildren={false} />
						</ErrorBoundary>
					);
				});

				expect(Scheduler).toHaveYielded([
					'ErrorBoundary render success',
					'BrokenUseEffectCleanup useEffect destroy',
					'ErrorBoundary static getDerivedStateFromError',
					'ErrorBoundary render error',
					'ErrorBoundary componentDidCatch'
				]);

				expect(ReactNoop.getChildren()).toEqual([
					span('ErrorBoundary fallback')
				]);
			});

			// @gate skipUnmountedBoundaries
			it('should rethrow error if there are no still-mounted boundaries', () => {
				function Conditional({ showChildren }) {
					if (showChildren) {
						return (
							<ErrorBoundary>
								<BrokenUseEffectCleanup />
							</ErrorBoundary>
						);
					} else {
						return null;
					}
				}

				act(() => {
					ReactNoop.render(<Conditional showChildren={true} />);
				});

				expect(Scheduler).toHaveYielded([
					'ErrorBoundary render success',
					'BrokenUseEffectCleanup useEffect'
				]);

				expect(() => {
					act(() => {
						ReactNoop.render(<Conditional showChildren={false} />);
					});
				}).toThrow('Expected error');

				expect(Scheduler).toHaveYielded([
					'BrokenUseEffectCleanup useEffect destroy'
				]);

				expect(ReactNoop.getChildren()).toEqual([]);
			});
		});

		it('calls passive effect destroy functions for memoized components', () => {
			const Wrapper = ({ children }) => children;
			function Child() {
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('passive create');
					return () => {
						Scheduler.unstable_yieldValue('passive destroy');
					};
				}, []);
				React.useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('layout create');
					return () => {
						Scheduler.unstable_yieldValue('layout destroy');
					};
				}, []);
				Scheduler.unstable_yieldValue('render');
				return null;
			}

			const isEqual = (prevProps, nextProps) =>
				prevProps.prop === nextProps.prop;
			const MemoizedChild = React.memo(Child, isEqual);

			act(() => {
				ReactNoop.render(
					<Wrapper>
						<MemoizedChild key={1} />
					</Wrapper>
				);
			});
			expect(Scheduler).toHaveYielded([
				'render',
				'layout create',
				'passive create'
			]);

			// Include at least one no-op (memoized) update to trigger original bug.
			act(() => {
				ReactNoop.render(
					<Wrapper>
						<MemoizedChild key={1} />
					</Wrapper>
				);
			});
			expect(Scheduler).toHaveYielded([]);

			act(() => {
				ReactNoop.render(
					<Wrapper>
						<MemoizedChild key={2} />
					</Wrapper>
				);
			});
			expect(Scheduler).toHaveYielded([
				'render',
				'layout destroy',
				'layout create',
				'passive destroy',
				'passive create'
			]);

			act(() => {
				ReactNoop.render(null);
			});
			expect(Scheduler).toHaveYielded(['layout destroy', 'passive destroy']);
		});

		it('calls passive effect destroy functions for descendants of memoized components', () => {
			const Wrapper = ({ children }) => children;
			function Child() {
				return <Grandchild />;
			}

			function Grandchild() {
				React.useEffect(() => {
					Scheduler.unstable_yieldValue('passive create');
					return () => {
						Scheduler.unstable_yieldValue('passive destroy');
					};
				}, []);
				React.useLayoutEffect(() => {
					Scheduler.unstable_yieldValue('layout create');
					return () => {
						Scheduler.unstable_yieldValue('layout destroy');
					};
				}, []);
				Scheduler.unstable_yieldValue('render');
				return null;
			}

			const isEqual = (prevProps, nextProps) =>
				prevProps.prop === nextProps.prop;
			const MemoizedChild = React.memo(Child, isEqual);

			act(() => {
				ReactNoop.render(
					<Wrapper>
						<MemoizedChild key={1} />
					</Wrapper>
				);
			});
			expect(Scheduler).toHaveYielded([
				'render',
				'layout create',
				'passive create'
			]);

			// Include at least one no-op (memoized) update to trigger original bug.
			act(() => {
				ReactNoop.render(
					<Wrapper>
						<MemoizedChild key={1} />
					</Wrapper>
				);
			});
			expect(Scheduler).toHaveYielded([]);

			act(() => {
				ReactNoop.render(
					<Wrapper>
						<MemoizedChild key={2} />
					</Wrapper>
				);
			});
			expect(Scheduler).toHaveYielded([
				'render',
				'layout destroy',
				'layout create',
				'passive destroy',
				'passive create'
			]);

			act(() => {
				ReactNoop.render(null);
			});
			expect(Scheduler).toHaveYielded(['layout destroy', 'passive destroy']);
		});

		it('assumes passive effect destroy function is either a function or undefined', () => {
			function App(props) {
				useEffect(() => {
					return props.return;
				});
				return null;
			}

			const root1 = ReactNoop.createRoot();
			expect(() =>
				act(() => {
					root1.render(<App return={17} />);
				})
			).toErrorDev([
				'Warning: useEffect must not return anything besides a ' +
					'function, which is used for clean-up. You returned: 17'
			]);

			const root2 = ReactNoop.createRoot();
			expect(() =>
				act(() => {
					root2.render(<App return={null} />);
				})
			).toErrorDev([
				'Warning: useEffect must not return anything besides a ' +
					'function, which is used for clean-up. You returned null. If your ' +
					'effect does not require clean up, return undefined (or nothing).'
			]);

			const root3 = ReactNoop.createRoot();
			expect(() =>
				act(() => {
					root3.render(<App return={Promise.resolve()} />);
				})
			).toErrorDev([
				'Warning: useEffect must not return anything besides a ' +
					'function, which is used for clean-up.\n\n' +
					'It looks like you wrote useEffect(async () => ...) or returned a Promise.'
			]);

			// Error on unmount because React assumes the value is a function
			expect(() =>
				act(() => {
					root3.unmount();
				})
			).toThrow('is not a function');
		});
	});
});
