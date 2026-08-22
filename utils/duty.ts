import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot } from '../config.ts';
import { DUTY_LIST_PREVIEW_LENGTH } from '../constants.ts';
import type { DutyData } from '../types.ts';

const dutyFilePath = join(projectRoot, 'data', 'duty.json');

function readDutyData(): DutyData {
    return JSON.parse(readFileSync(dutyFilePath, 'utf8')) as DutyData;
}

export function getDutyList(): string[] {
    return readDutyData().order;
}

export function writeDutyList(
    list: string[],
    rerollIndices: number[] | null = null,
    currentIndex = 0,
): void {
    const fullList = readDutyData();
    fullList.order = list;
    fullList.rerollIndices = rerollIndices;
    fullList.currentIndex = currentIndex;
    writeFileSync(dutyFilePath, JSON.stringify(fullList));
}

export function completeDuty(list: string[]): string[] {
    const completed = list.shift();
    if (completed === undefined) return list;
    list.push(completed);
    writeDutyList(list, [], 0); // Reset reroll indices and current index
    return list;
}

export function repeatDuty(list: string[]): string[] {
    const repeat = list.pop();
    if (repeat === undefined) return list;
    list.unshift(repeat);
    writeDutyList(list);
    return list;
}

export function rerollDuty(list: string[]): string[] {
    const data = readDutyData();
    const rerollIndices = data.rerollIndices ?? [];
    let currentIndex = data.currentIndex ?? 0;

    rerollIndices.push(currentIndex); // Store the current index before rerolling

    const [newCurrent] = list.splice(currentIndex, 1);
    if (newCurrent === undefined) return list;
    list.splice(0, 0, newCurrent);
    currentIndex++;
    writeDutyList(list, rerollIndices, currentIndex);
    return list;
}

export function undoRerollDuty(list: string[]): string[] {
    const data = readDutyData();
    const rerollIndices = data.rerollIndices ?? [];
    const currentIndex = data.currentIndex ?? 0;

    if (rerollIndices.length === 0) {
        return list; // Nothing to undo
    }

    const previousIndex = rerollIndices.pop() ?? currentIndex; // Get the previous index
    const [newCurrent] = list.splice(0, 1);
    if (newCurrent === undefined) return list;
    list.splice(previousIndex, 0, newCurrent);

    writeDutyList(list, rerollIndices, Math.max(0, previousIndex)); // Update indices, prevent negative index
    return list;
}

export function getStringList(list: string[]): string {
    let stringList = '';
    list.every((id, i) => {
        if (i >= DUTY_LIST_PREVIEW_LENGTH) return false;
        stringList += i === 0 ? `<@${id}> :rewind:` : ` <@${id}>`;
        return true;
    });
    stringList += '...';
    return stringList;
}

/** The person currently on duty — the head of the order. */
export function getCurrentDuty(list: string[]): string {
    const current = list[0];
    if (current === undefined) {
        throw new Error('Duty order is empty — nobody is on duty.');
    }
    return current;
}
