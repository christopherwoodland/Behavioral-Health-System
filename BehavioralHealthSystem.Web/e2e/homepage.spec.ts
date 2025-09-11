import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Behavioral Health System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have accessible homepage', async ({ page }) => {
    // Check that the page loads
    await expect(page).toHaveTitle(/Behavioral Health System/);
    
    // Check main heading
    await expect(page.getByRole('heading', { name: 'Behavioral Health System' })).toBeVisible();
    
    // Check navigation is present
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    
    // Check quick actions are present
    await expect(page.getByRole('link', { name: /Upload & Analyze/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /View Sessions/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /My Predictions/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /System Health/ })).toBeVisible();
    
    // Run accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test skip to content link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    
    // Test theme toggle is keyboard accessible
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const themeToggle = page.getByRole('button', { name: /Switch to.*mode/ });
    await expect(themeToggle).toBeFocused();
    
    // Test theme toggle works with keyboard
    await page.keyboard.press('Enter');
    // Check that dark mode class is applied
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should navigate between pages', async ({ page }) => {
    // Navigate to Upload page
    await page.getByRole('link', { name: /Upload & Analyze/ }).click();
    await expect(page).toHaveURL('/upload');
    await expect(page.getByRole('heading', { name: 'Upload & Analyze' })).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: /Sessions/ }).click();
    await expect(page).toHaveURL('/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    
    // Navigate back to Dashboard
    await page.getByRole('link', { name: /Dashboard/ }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Behavioral Health System' })).toBeVisible();
  });

  test('should display user ID', async ({ page }) => {
    // Check that user ID is displayed
    await expect(page.getByText('Your User ID')).toBeVisible();
    
    // Check that user ID looks like a UUID
    const userIdElement = page.locator('code').first();
    await expect(userIdElement).toBeVisible();
    
    const userIdText = await userIdElement.textContent();
    expect(userIdText).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that mobile menu button appears
    await expect(page.getByRole('button', { name: 'Open mobile menu' })).toBeVisible();
    
    // Check that desktop navigation is hidden
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Check that layout adjusts appropriately
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });
});
