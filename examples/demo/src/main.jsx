import { useState } from 'react';
import ReactDom from 'react-dom';
// import ReactDom from 'react-noop-renderer';

import React, { useEffect } from 'react';

// import './index.css';

function Children({ children }) {
	// useEffect(() => {
	// 	console.log('child mount1 ');
	// 	return () => {
	// 		console.log('child unmount1');
	// 	};
	// }, []);
	// useEffect(() => {
	// 	console.log('child mount 2 ');
	// 	return () => {
	// 		console.log('child unmount 2');
	// 	};
	// }, []);
	// const arr =
	// 	num % 2 === 0
	// 		? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
	// 		: [<li key="2">2</li>, <li key="3">3</li>, <li key="1">1</li>];
	const now = performance.now();
	while (performance.now() - now < 5) {}
	return <div>{children}</div>;
}

function App() {
	const [num, setNum] = useState(100);

	return (
		<div
			onClick={() => {
				setNum(50);
			}}
		>
			{new Array(num).fill(0).map((item, index) => (
				<Children key={index}>{index}</Children>
			))}
		</div>
	);
}

// debugger;
const root = ReactDom.createRoot(document.querySelector('#root'));
// const root = ReactDom.createRoot();

root.render(<App />);

window.root = root;
