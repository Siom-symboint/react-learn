import { useState } from 'react';
import ReactDom from 'react-dom';
import React from 'react';

// import './index.css';

function Children() {
	const [num, setNum] = useState(0);
	const arr =
		num % 2 === 0
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="2">2</li>, <li key="3">3</li>, <li key="1">1</li>];
	return (
		<div
			onClick={() => {
				setNum(num + 1);
			}}
		>
			<li key="4">4</li>
			<li key="5">5</li>
			{arr}
		</div>
	);
}

function App() {
	return <Children />;
}
const num = [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>];
console.log(
	<div>
		<li key="4">4</li>
		<li key="5">5</li>
		{num}
	</div>
);

// debugger;
ReactDom.createRoot(document.querySelector('#root')).render(<App />);
