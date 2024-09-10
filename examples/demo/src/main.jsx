import { useState } from 'react';
import ReactDom from 'react-dom';
import React, { useEffect } from 'react';

// import './index.css';

function Children() {
	useEffect(() => {
		console.log('child mount ');
		return () => {
			console.log('child unmount');
		};
	}, []);
	// const arr =
	// 	num % 2 === 0
	// 		? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
	// 		: [<li key="2">2</li>, <li key="3">3</li>, <li key="1">1</li>];
	return <div>children</div>;
}

function App() {
	const [num, setNum] = useState(0);
	const [str, setStr] = useState('str');

	useEffect(() => {
		console.log('App mount ');
		// setNum((num) => num + 1);
		return () => {
			console.log('child unmount');
		};
	}, []);

	useEffect(() => {
		console.log('num change create', num);
		return () => {
			console.log('num change destory', num);
		};
	}, [num]);
	return (
		<div
			onClick={() => {
				setNum((num) => num + 1);
				setStr('2222');
			}}
		>
			{num}
			{str === '2222' ? 'noop' : <Children />}
		</div>
	);
}

// debugger;
ReactDom.createRoot(document.querySelector('#root')).render(<App />);
