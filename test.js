// let ts = 1663468804.962209;
// console.log(ts);
// let result = new Date(ts*1000);
// console.log(result);

// result.setHours( result.getHours() + 9);
// console.log(result.toLocaleDateString('fr-FR'));
// console.log(result.toLocaleDateString());

// let dataItems = [ { task: { S: '米を研ぐ' } }, { task: { S: '台風を眺める' } } ];

// let text = "";

// dataItems.forEach((element) => {
//   text += `- ${element.task.S}\n`;
// })

// console.log(text);

let arr;

arr = [ { task: { S: '米を研ぐ' } }, { task: { S: '台風を眺める' } } ];

console.log(arr);
console.log(Array.isArray(arr));

let arr2 = [1, 3];
console.log(Array.isArray(arr2));
