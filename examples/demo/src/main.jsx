import { useState } from 'react';
import ReactDom from 'react-dom';
import React from 'react';

// import './index.css';

function App() {
	const [num, setNum] = useState(3);
	window.setNum = setNum;
	return num === 4 ? <Children /> : num;
}

function Children() {
	return <span>Children</span>;
}

// debugger;
ReactDom.createRoot(document.querySelector('#root')).render(<App />);
