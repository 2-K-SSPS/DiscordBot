const {readFileSync, writeFileSync} = require("fs");

function getDutyList() {
    let data = JSON.parse(readFileSync('data/duty.json', 'utf8'));
    return data["order"];
}

function writeDutyList(list, rerollIndices=null, currentIndex = 0) {
    let fullList = JSON.parse(readFileSync('data/duty.json', 'utf8'));
    fullList["order"] = list;
    fullList["rerollIndices"] = rerollIndices;
    fullList["currentIndex"] = currentIndex;
    writeFileSync('data/duty.json', JSON.stringify(fullList));
}

function completeDuty(list) {
    let completed = list.shift();
    list.push(completed);
    writeDutyList(list, [], 0); // Reset reroll indices and current index
    return list;
}

function repeatDuty(list) {
    let repeat = list.pop();
    list.unshift(repeat);
    writeDutyList(list);
    return list;
}

function rerollDuty(list) {
    let data = JSON.parse(readFileSync('data/duty.json', 'utf8'));
    let rerollIndices = data["rerollIndices"] || [];
    let currentIndex = data["currentIndex"] || 0;

    rerollIndices.push(currentIndex); // Store the current index before rerolling

    let newCurrent = list.splice(currentIndex, 1)[0];
    list.splice(0, 0, newCurrent);
    currentIndex++;
    writeDutyList(list, rerollIndices, currentIndex);
    return list;
}

function undoRerollDuty(list) {
    let data = JSON.parse(readFileSync('data/duty.json', 'utf8'));
    let rerollIndices = data["rerollIndices"] || [];
    let currentIndex = data["currentIndex"] || 0;

    if (rerollIndices.length === 0) {
        return list; // Nothing to undo
    }

    let previousIndex = rerollIndices.pop(); // Get the previous index
    let newCurrent = list.splice(0, 1)[0];
    list.splice(previousIndex, 0, newCurrent);

    writeDutyList(list, rerollIndices, Math.max(0, previousIndex)); // Update indices, prevent negative index
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