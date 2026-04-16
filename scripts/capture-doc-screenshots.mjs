import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3001";
const OUTPUT_DIR = "D:/AOP/mockup-admin-csi/doc-screenshots";
const DOCUMENTATION_SURVEY_ID = "FE08B728-6DA5-4D28-B8E4-B398383668A4";

const credentials = {
  superadmin: { username: "superadmin", password: "admin123" },
  adminEvent: { username: "firman", password: "admin123" },
  itLead: { username: "sinta", password: "admin123" },
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function output(name) {
  return path.join(OUTPUT_DIR, `${name}.png`);
}

async function waitForUi(page, selector = "body") {
  if (selector && selector !== "body") {
    await page.locator(selector).first().waitFor({ state: "attached", timeout: 45_000 }).catch(() => {});
  }
  await page.waitForFunction(() => document.readyState === "complete", { timeout: 120_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

async function goto(page, url, selector = "body") {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitForUi(page, selector);
}

async function capture(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: output(name),
    fullPage: false,
    animations: "disabled",
  });
  console.log(`CAPTURED ${name}`);
}

async function login(browser, accountKey, nextTarget = "/admin/dashboard") {
  const { username, password } = credentials[accountKey];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
  });
  const response = await context.request.post("http://localhost:3000/api/v1/auth/login", {
    headers: { "Content-Type": "application/json" },
    data: { username, password },
    timeout: 120_000,
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${username}: ${response.status()} ${response.statusText()}`);
  }

  const payload = await response.json();
  if (!payload?.success || !payload?.user) {
    throw new Error(`Login payload invalid for ${username}`);
  }

  await context.addInitScript((user) => {
    window.sessionStorage.setItem("csi_user", JSON.stringify(user));
    window.sessionStorage.setItem("csi_session_present", "1");
  }, payload.user);

  const page = await context.newPage();
  await goto(page, nextTarget, "body");

  return { context, page };
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    const publicContext = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      deviceScaleFactor: 1,
    });
    const publicPage = await publicContext.newPage();
    await goto(publicPage, "/login", "input#username");
    await capture(publicPage, "01-login");
    await publicContext.close();

    const admin = await login(browser, "adminEvent");
    const adminPage = admin.page;

    await goto(adminPage, "/admin/dashboard", "h1");
    await capture(adminPage, "02-dashboard");

    await goto(adminPage, "/admin/event-management", "text=Daftar Event");
    await capture(adminPage, "03-event-management");

    const builderLink = `/admin/event-management/survey-create?surveyId=${DOCUMENTATION_SURVEY_ID}`;
    const operationsLink = `/admin/event-management/${DOCUMENTATION_SURVEY_ID}/operations`;
    const publicSurveyId = DOCUMENTATION_SURVEY_ID;

    await goto(adminPage, builderLink, "text=Survey Builder");
    await capture(adminPage, "04-survey-builder");

    await goto(adminPage, operationsLink, "text=Generate Link");
    await capture(adminPage, "05-operations");

    const publicSurveyContext = await browser.newContext({
      viewport: { width: 1440, height: 1024 },
      deviceScaleFactor: 1,
    });
    const publicSurveyPage = await publicSurveyContext.newPage();
    await goto(publicSurveyPage, `/survey/${publicSurveyId}`, "body");
    await capture(publicSurveyPage, "06-public-survey");
    await publicSurveyContext.close();

    await goto(adminPage, "/admin/approval-admin", "text=Approval Admin");
    await capture(adminPage, "07-approval-admin");

    await goto(adminPage, "/admin/best-comments", "text=Best Comments Management");
    await capture(adminPage, "09-best-comments");

    await goto(adminPage, "/admin/report", "text=Report");
    await capture(adminPage, "10-report");

    await goto(adminPage, "/admin/master-bu", "text=Master BU");
    await capture(adminPage, "12-master-bu");

    await goto(adminPage, "/admin/master-divisi", "text=Master Divisi");
    await capture(adminPage, "13-master-division");

    await goto(adminPage, "/admin/master-department", "text=Master Department");
    await capture(adminPage, "14-master-department");

    await goto(adminPage, "/admin/master-function", "text=Master Function");
    await capture(adminPage, "15-master-function");

    await goto(adminPage, "/admin/master-aplikasi", "text=Master Aplikasi");
    await capture(adminPage, "16-master-application");

    await goto(adminPage, "/admin/dept-aplikasi", "text=Dept -> Aplikasi");
    await capture(adminPage, "17-mapping-department-application");

    await goto(adminPage, "/admin/function-aplikasi", "text=Function -> Aplikasi");
    await capture(adminPage, "18-mapping-function-application");

    await admin.context.close();

    const superAdmin = await login(browser, "superadmin");
    const superPage = superAdmin.page;

    await goto(superPage, "/admin/master-user", "text=Master User");
    await capture(superPage, "11-master-user");

    await superAdmin.context.close();

    const itLead = await login(browser, "itLead");
    const itLeadPage = itLead.page;

    await goto(itLeadPage, "/admin/approval-it-lead", "text=Approval IT Lead");
    await capture(itLeadPage, "08-approval-it-lead");

    await itLead.context.close();

    console.log(`DONE -> ${OUTPUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
