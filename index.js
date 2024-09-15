function test(str) {
	let stack = [];
	let map = { '}': '{', ')': '(', ']': '[' };

	for (let i of str) {
		if (map[i]) {
			if (stack.length === 0 || stack.pop() !== map[i]) {
				return false;
			}
		} else {
			stack.push(i);
		}
	}
	return stack.length === 0;
}

console.log(test('()'));
