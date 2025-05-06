const {readFileSync, writeFileSync} = require("fs");

function getDutyList() {
    let list = JSON.parse(readFileSync('data/duty.json', 'utf8'));
    return list["order"];
}

function writeDutyList(list, rerollIndex=null) {
    let fullList = JSON.parse(readFileSync('data/duty.json', 'utf8'));
    fullList["order"] = list;
    if (rerollIndex) {fullList["rerollIndex"] = rerollIndex;}
    writeFileSync('data/duty.json', JSON.stringify(fullList));
}

function completeDuty(list) {
    let completed = list.shift();
    list.push(completed);
    writeDutyList(list, 1); // Reset reroll indexu protože nejspíš uběhl už ten týden
    return list;
}

function repeatDuty(list) {
    let repeat = list.pop();
    list.unshift(repeat);
    writeDutyList(list);
    return list;
}

function rerollDuty(list) {
    let rerollIndex = JSON.parse(readFileSync('data/duty.json', 'utf8'))["rerollIndex"]; // Reroll index je zde kvůli tomu že pokud chybí 2 lidi co jsou v seznamu za sebou tak by se točili mezi sebou
    let newCurrent = list.splice(rerollIndex, 1)[0]
    list.splice(0, 0, newCurrent);
    rerollIndex++;
    writeDutyList(list, rerollIndex);
    return list;
}

function undoRerollDuty(list) {
    let rerollIndex = JSON.parse(readFileSync('data/duty.json', 'utf8'))["rerollIndex"];
    rerollIndex--;
    if (rerollIndex < 1) rerollIndex = 1;
    let newCurrent = list.splice(0, 1)[0];
    list.splice(rerollIndex-1, 0, newCurrent);
    writeDutyList(list, rerollIndex);
    return list;
}

function getStringList(list) {
    let stringList = ""
    list.every((id, i) => {
        if (i > 5) return false;
        stringList += i === 0 ? `<@${id}> :rewind:` : ` <@${id}>`;
        return true;
    })
    stringList += "..."
    return stringList;
}

module.exports = {
    getDutyList,
    completeDuty,
    repeatDuty,
    rerollDuty,
    undoRerollDuty,
    getStringList,
};