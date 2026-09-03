import { expect, test } from '@playwright/test'

test('admin can enter live eval and grade a deterministic journey', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Sign in as admin' }).click()
  await expect(page.getByText('Admin workspace')).toBeVisible()
  await page.getByRole('button', { name: 'Live eval', exact: true }).click()
  await expect(page.getByText('Live evaluation')).toBeVisible()
  await page.getByRole('button', { name: 'Run deterministic preview' }).click()
  await expect(page.locator('.call-card').filter({ hasText: 'add_ticket_note' })).toBeVisible()
  await page.getByRole('button', { name: 'Finish & grade' }).click()
  await expect(page.locator('.grade-score')).toContainText('100')
})
