import assert from 'node:assert/strict';
import { test } from 'node:test';
import User from '../models/User.js';

test('user save hook hashes passwords and comparePassword verifies them', async () => {
  const user = new User({ name: 'Test User', email: 'TEST@example.com', password: 'correct horse battery staple' });
  const hashPassword = User.schema.s.hooks._pres.get('save').find((hook) => hook.fn.name === 'hashPassword').fn;
  await hashPassword.call(user);

  assert.notEqual(user.password, 'correct horse battery staple');
  assert.equal(await user.comparePassword('correct horse battery staple'), true);
  assert.equal(await user.comparePassword('incorrect password'), false);
});

test('user JSON excludes password and applies safe defaults', async () => {
  const user = new User({ name: 'Test User', email: 'TEST@example.com', password: 'correct horse battery staple' });
  await user.validate();
  const serialized = user.toJSON();

  assert.equal(serialized.email, 'test@example.com');
  assert.equal(serialized.role, 'user');
  assert.equal(serialized.isActive, true);
  assert.equal(Object.hasOwn(serialized, 'password'), false);
});
