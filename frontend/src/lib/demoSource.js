// Sample data for demo mode. Everything is fictional and lives in memory,
// so visitors can click around (and even delete things) without an account.

const day = (offset, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const iso = (offset, hour) => day(offset, hour).toISOString();
const dateOnly = (offset) => iso(offset).slice(0, 10);

const SEED = [
  ["Northwind Analytics", "Graduate Data Engineer", "interview", "upcoming", -2, [
    [-20, "Thanks for applying to Northwind Analytics", "Hi there,\n\nThanks for applying for the Graduate Data Engineer role. Our team will review your application and be in touch within two weeks.\n\nNorthwind Talent Team"],
    [-9, "Northwind - online assessment", "Hi,\n\nWe'd like to invite you to complete our online assessment. Please complete it within 5 days.\n\nGood luck!"],
    [-2, "Interview confirmed: Graduate Data Engineer", "Hi,\n\nYour first-round interview is confirmed. You'll meet two engineers from the platform team for 45 minutes.\n\nSee you then!"],
  ], [2, 14, 45]],
  ["Halcyon Capital", "Quantitative Analyst", "assessment", "deadline", -1, [
    [-12, "Application received - Quantitative Analyst", "Dear candidate,\n\nWe confirm receipt of your application to Halcyon Capital."],
    [-1, "Next steps: HackerRank assessment", "Hello,\n\nPlease complete the attached HackerRank assessment by the end of the week. It should take around 90 minutes."],
  ], [4, 23, null]],
  ["Brightline Health", "Software Engineer", "action_required", "action_required", 0, [
    [-6, "Your application to Brightline Health", "Hi,\n\nThank you for your interest in Brightline Health. We have received your application."],
    [0, "Please share your availability", "Hi,\n\nThe hiring manager would like to speak with you. Could you share a few times that work for you next week?\n\nThanks,\nPriya (Recruiting)"],
  ]],
  ["Orbital Labs", "Backend Engineer (Python)", "interview", "upcoming", -3, [
    [-25, "Orbital Labs application confirmation", "Thanks for applying to Orbital Labs!"],
    [-14, "Coding challenge completed", "Thanks for completing the coding challenge, we'll be in touch shortly."],
    [-3, "Final round invitation", "Congratulations! We'd like to invite you to our final round: a system design interview and a meeting with the CTO."],
  ], [6, 10, 120]],
  ["Cobalt Systems", "Junior DevOps Engineer", "applied", "applied", -4, [
    [-4, "We've received your application", "Hi,\n\nThanks for applying to Cobalt Systems. We'll review your application and get back to you."],
  ]],
  ["Fernhill Energy", "Data Analyst", "applied", "applied", -8, [
    [-8, "Fernhill Energy - Application received", "Thank you for applying for the Data Analyst position."],
  ]],
  ["Lumen Robotics", "Machine Learning Intern", "applied", "applied", -15, [
    [-15, "Lumen Robotics: thanks for applying", "We appreciate your interest in the Machine Learning Intern role."],
  ]],
  ["Kestrel Bank", "Technology Analyst", "assessment", "completed", -5, [
    [-18, "Kestrel Bank application", "Your application for the Technology Analyst programme has been received."],
    [-5, "Assessment centre - thank you", "Thank you for attending our assessment centre. We will share the outcome within 10 working days."],
  ]],
  ["Meridian Games", "Gameplay Programmer", "interview", "accepted", -1, [
    [-30, "Application received", "Thanks for applying to Meridian Games!"],
    [-16, "Technical interview scheduled", "Your technical interview has been scheduled."],
    [-1, "Offer of employment", "We're delighted to offer you the position of Gameplay Programmer at Meridian Games! Please find the details attached."],
  ]],
  ["Atlas Logistics", "Software Engineer", "applied", "rejected", -10, [
    [-22, "Atlas Logistics - application received", "Thank you for applying."],
    [-10, "Update on your application", "Unfortunately, we have decided to move forward with other candidates whose experience more closely matches our needs."],
  ]],
  ["Pinecrest Insurance", "Graduate Developer", "interview", "rejected", -7, [
    [-28, "Thanks for applying", "We've received your application to Pinecrest."],
    [-7, "Interview outcome", "Thank you for interviewing with us. On this occasion we will not be progressing your application."],
  ]],
  ["Vantage AI", "AI Engineer", "action_required", "action_required", -2, [
    [-2, "You have a new message on LinkedIn", "Sam from Vantage AI sent you a message: \"Hi! Would you be open to a quick chat about our AI Engineer role?\""],
  ]],
];

const NEW_ON_SYNC = [
  ["Harbour Retail", "Platform Engineer", "applied", "applied", [[0, "Thanks for applying to Harbour Retail", "We've received your application for the Platform Engineer role."]]],
  ["Quill & Co", "Full Stack Developer", "action_required", "action_required", [[0, "Quick question about your application", "Hi, could you confirm your notice period and right to work?"]]],
];

function build() {
  const apps = [], events = [], calendar = [];
  let eid = 1;
  SEED.forEach(([company, job_title, stage, substate, latest, mails, cal], i) => {
    const id = `demo-${i}`;
    apps.push({ application_id: id, company, job_title, stage, substate, latest_date: dateOnly(latest),
      applied_date: dateOnly(mails[0][0]), position: "FULL_TIME", email_address: `careers@${company.split(" ")[0].toLowerCase()}.example` });
    mails.forEach(([off, subject, text]) => events.push({ event_id: eid++, application_id: id, event_date: iso(off, 9), event_summary: subject, email_text: text }));
    if (cal) {
      const [off, hour, duration] = cal;
      calendar.push({ event_id: eid++, date: dateOnly(off), time: `${String(hour).padStart(2, "0")}:00:00`, duration,
        job_applications: { application_id: id, company, job_title, stage } });
    }
  });
  return { apps, events, calendar };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function demoSource() {
  const db = build();
  let sync = { state: "idle" };
  let synced = false;

  return {
    demo: true,
    listApplications: async () => [...db.apps],
    listEvents: async (id) => db.events.filter((e) => e.application_id === id),
    listCalendar: async () => [...db.calendar],
    deleteApplication: async (id) => {
      db.apps = db.apps.filter((a) => a.application_id !== id);
      db.calendar = db.calendar.filter((c) => c.job_applications.application_id !== id);
    },
    listAccounts: async () => [{ id: 1, email: "demo.candidate@gmail.com", last_synced: Date.now() - 3_600_000 }],
    disconnectAccount: async () => { throw new Error("Connecting Gmail is disabled in the demo."); },
    connectGmail: async () => { throw new Error("Connecting Gmail is disabled in the demo."); },

    // Plays back what a real sync looks like.
    startSync: async () => {
      sync = { state: "running", step: "Checking demo.candidate@gmail.com for new mail", scanned: 0, relevant: 0, added: 0, updated: 0, errors: [] };
      (async () => {
        await wait(700);
        Object.assign(sync, { step: "Screening 37 emails for job updates", scanned: 37 });
        await wait(1100);
        Object.assign(sync, { step: "Analysing 2 job emails", relevant: synced ? 0 : 2 });
        await wait(1200);
        if (!synced) {
          NEW_ON_SYNC.forEach(([company, job_title, stage, substate, mails], i) => {
            const id = `demo-new-${i}`;
            db.apps.push({ application_id: id, company, job_title, stage, substate, latest_date: dateOnly(0), applied_date: dateOnly(0), position: "FULL_TIME" });
            mails.forEach(([off, subject, text]) => db.events.push({ event_id: 1000 + i, application_id: id, event_date: iso(off, 11), event_summary: subject, email_text: text }));
          });
          sync.added = 2;
          synced = true;
        }
        Object.assign(sync, { state: "done", step: "Finished" });
      })();
      return sync;
    },
    syncStatus: async () => ({ ...sync }),
  };
}
