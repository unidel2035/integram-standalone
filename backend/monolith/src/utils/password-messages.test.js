/**
 * Regression tests for issue #423:
 * Password change messages must be bilingual (matching PHP t9n() output)
 * and include error code suffixes ([errShort], [errOld], [errDiffer]).
 */
import { describe, it, expect } from 'vitest';
import { t9n } from './t9n.js';

// Reproduce the exact message-building logic from legacy-compat.js password change
function buildPasswordChangeMsg(npw1, npw2, currentPassword, locale) {
  let msg = '';
  if (npw1.length < 6) {
    msg += t9n('[RU]Новый пароль должен быть не короче 6 символов[EN]Password must be at lest 6 symbols long', locale) + ' [errShort]. ';
  } else if (npw1 === currentPassword) {
    msg += t9n('[RU]Новый пароль должен отличаться от старого[EN]The new password must differ from the old one', locale) + ' [errOld]. ';
  } else if (npw1 !== npw2) {
    msg += t9n('[RU]Введите новый пароль дважды одинаково[EN]Please input the same password twice', locale) + ' [errDiffer]. ';
  } else {
    msg += t9n('[RU]Пароль успешно изменен[EN]The password has been changed', locale);
  }
  return msg;
}

describe('Password change messages (#423)', () => {
  describe('EN locale', () => {
    it('short password includes [errShort] suffix', () => {
      const msg = buildPasswordChangeMsg('ab', 'ab', 'oldpwd', 'EN');
      expect(msg).toBe('Password must be at lest 6 symbols long [errShort]. ');
    });

    it('same-as-old password includes [errOld] suffix', () => {
      const msg = buildPasswordChangeMsg('samepass', 'samepass', 'samepass', 'EN');
      expect(msg).toBe('The new password must differ from the old one [errOld]. ');
    });

    it('mismatched passwords includes [errDiffer] suffix', () => {
      const msg = buildPasswordChangeMsg('newpass1', 'newpass2', 'oldpwd', 'EN');
      expect(msg).toBe('Please input the same password twice [errDiffer]. ');
    });

    it('successful change has no error suffix', () => {
      const msg = buildPasswordChangeMsg('newpass1', 'newpass1', 'oldpwd', 'EN');
      expect(msg).toBe('The password has been changed');
    });
  });

  describe('RU locale', () => {
    it('short password is in Russian with [errShort] suffix', () => {
      const msg = buildPasswordChangeMsg('ab', 'ab', 'oldpwd', 'RU');
      expect(msg).toBe('Новый пароль должен быть не короче 6 символов [errShort]. ');
    });

    it('same-as-old password is in Russian with [errOld] suffix', () => {
      const msg = buildPasswordChangeMsg('samepass', 'samepass', 'samepass', 'RU');
      expect(msg).toBe('Новый пароль должен отличаться от старого [errOld]. ');
    });

    it('mismatched passwords is in Russian with [errDiffer] suffix', () => {
      const msg = buildPasswordChangeMsg('newpass1', 'newpass2', 'oldpwd', 'RU');
      expect(msg).toBe('Введите новый пароль дважды одинаково [errDiffer]. ');
    });

    it('successful change is in Russian', () => {
      const msg = buildPasswordChangeMsg('newpass1', 'newpass1', 'oldpwd', 'RU');
      expect(msg).toBe('Пароль успешно изменен');
    });
  });

  describe('error messages contain [err marker for early-return check', () => {
    it('errShort contains [err', () => {
      const msg = buildPasswordChangeMsg('ab', 'ab', 'oldpwd', 'EN');
      expect(msg).toContain('[err');
    });

    it('errOld contains [err', () => {
      const msg = buildPasswordChangeMsg('samepass', 'samepass', 'samepass', 'EN');
      expect(msg).toContain('[err');
    });

    it('errDiffer contains [err', () => {
      const msg = buildPasswordChangeMsg('newpass1', 'newpass2', 'oldpwd', 'EN');
      expect(msg).toContain('[err');
    });

    it('success message does NOT contain [err', () => {
      const msg = buildPasswordChangeMsg('newpass1', 'newpass1', 'oldpwd', 'EN');
      expect(msg).not.toContain('[err');
    });
  });
});
