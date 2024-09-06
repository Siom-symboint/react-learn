import { useState } from 'react';
import ReactDom from 'react-dom';
import React from 'react';

// import './index.css';

function App() {
	const [num] = useState(33);

	return (
		<div>
			<span>{num}</span>
		</div>
	);
}

function Children() {
	const [num] = useState('children');

	return <span>{num}</span>;
}

// debugger;
ReactDom.createRoot(document.querySelector('#root')).render(<App />);
