import { beforeEach, expect, jest, test } from '@jest/globals';
import { Alert } from '../../src/services/alert';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
const buttons = () => [...document.querySelectorAll('dialog button')];

test('web errors are visible, escaped, and dismissible', () => {
  Alert.alert('Could not save', '<script>unsafe()</script>');
  expect(document.querySelector('dialog').open).toBe(true);
  expect(document.querySelector('dialog p').textContent).toBe('<script>unsafe()</script>');
  expect(document.querySelector('dialog script')).toBeNull();
  buttons()[0].click();
  expect(document.querySelector('dialog')).toBeNull();
});

test('only the chosen action runs, and alerts wait their turn', () => {
  const destructive = jest.fn();
  const cancel = jest.fn();
  Alert.alert('Remove?', 'Saved music', [{ text: 'Cancel', style: 'cancel', onPress: cancel }, { text: 'Remove', onPress: destructive }]);
  Alert.alert('Second notice');
  expect(document.querySelectorAll('dialog')).toHaveLength(1);
  buttons()[0].click();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(destructive).not.toHaveBeenCalled();
  expect(document.querySelector('dialog h2').textContent).toBe('Second notice');
  buttons()[0].click();
});

test('Escape only dismisses cancelable prompts and never confirms an action', () => {
  const confirm = jest.fn();
  const dismiss = jest.fn();
  Alert.alert('Confirm?', '', [{ text: 'Confirm', onPress: confirm }], { cancelable: true, onDismiss: dismiss });
  document.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
  expect(confirm).not.toHaveBeenCalled();
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(document.querySelector('dialog')).toBeNull();
});
