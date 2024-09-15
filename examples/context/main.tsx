import React, { useState, createContext, useContext } from 'react';
import ReactDOM from 'react-dom';

let a = 'originion value';
const ctxA = createContext(a);
const ctxB = createContext('default B');

function App() {
	return (
		<ctxA.Provider value={'a'}>
			<Cpn />
			<button
				onClick={() => {
					a = 'change';
				}}
			>
				test
			</button>
		</ctxA.Provider>
	);
}

function Cpn() {
	const a = useContext(ctxA);
	const b = useContext(ctxB);
	return (
		<div
			onClick={() => {
				a;
			}}
		>
			A: {a} B: {b}
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
