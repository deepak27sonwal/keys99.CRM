export type LeadStatus =
  | "New" | "Contacted" | "Interested" | "Qualified"
  | "Site Visit" | "Negotiation" | "Booked" | "Lost";

export interface Lead {
  id: string;
  customerId: string;
  name: string;
  mobile: string;
  email: string;
  requirement: string;
  budget: string;
  project: string;
  location: string;
  agent: string;
  status: LeadStatus;
  followUp: string;
  source: string;
  propertyType: string;
  bhk: string;
}

export const leads: Lead[] = [
  { id: "L-28651", customerId: "C-10586", name: "Rohit Sharma", mobile: "+91 98765 43210", email: "rohit.sharma@gmail.com", requirement: "Buy • 2–3 BHK", budget: "₹ 70L – 1.2Cr", project: "Shriram Nayra", location: "Undri, Pune", agent: "Ankit S.", status: "Qualified", followUp: "Nov 05, 04:00 PM", source: "Meta Ads", propertyType: "Residential", bhk: "2 – 3 BHK" },
  { id: "L-28650", customerId: "C-10585", name: "Neha Kapoor", mobile: "+91 97654 22109", email: "neha.kapoor@gmail.com", requirement: "Buy • 3 BHK", budget: "₹ 1.2Cr – 2Cr", project: "Godrej Emerald", location: "Hinjewadi, Pune", agent: "Priya M.", status: "Site Visit", followUp: "Nov 05, 12:30 PM", source: "Website", propertyType: "Residential", bhk: "3 BHK" },
  { id: "L-28649", customerId: "C-10584", name: "Amit Kulkarni", mobile: "+91 99887 66554", email: "amit.k@gmail.com", requirement: "Rent • 2 BHK", budget: "₹ 30K – 45K", project: "L&T Seawoods", location: "Navi Mumbai", agent: "Rakesh Y.", status: "New", followUp: "Nov 06, 10:00 AM", source: "Referral", propertyType: "Residential", bhk: "2 BHK" },
  { id: "L-28648", customerId: "C-10583", name: "Pooja Desai", mobile: "+91 91234 56708", email: "pooja.d@gmail.com", requirement: "Buy • 1–2 BHK", budget: "₹ 60L – 90L", project: "Tata Housing", location: "Kharadi, Pune", agent: "Neha G.", status: "Contacted", followUp: "Nov 04, 03:00 PM", source: "WhatsApp", propertyType: "Residential", bhk: "1 – 2 BHK" },
  { id: "L-28647", customerId: "C-10582", name: "Karan Patil", mobile: "+91 90011 22334", email: "karan.p@gmail.com", requirement: "Buy • 3 BHK", budget: "₹ 1Cr – 1.5Cr", project: "Godrej Emerald", location: "Hinjewadi, Pune", agent: "Aman V.", status: "Interested", followUp: "Nov 07, 11:00 AM", source: "Google Ads", propertyType: "Residential", bhk: "3 BHK" },
  { id: "L-28646", customerId: "C-10581", name: "Meera Joshi", mobile: "+91 98220 33445", email: "meera.j@gmail.com", requirement: "Buy • 2 BHK", budget: "₹ 75L – 1.1Cr", project: "Shriram Nayra", location: "Undri, Pune", agent: "Priya M.", status: "Site Visit", followUp: "Nov 06, 02:30 PM", source: "Meta Ads", propertyType: "Residential", bhk: "2 BHK" },
  { id: "L-28645", customerId: "C-10580", name: "Vikas More", mobile: "+91 97662 77889", email: "vikas.m@gmail.com", requirement: "Buy • 3–4 BHK", budget: "₹ 1.8Cr – 2.5Cr", project: "L&T Seawoods", location: "Navi Mumbai", agent: "Ankit S.", status: "Negotiation", followUp: "Nov 05, 05:00 PM", source: "Website", propertyType: "Residential", bhk: "3 – 4 BHK" },
  { id: "L-28644", customerId: "C-10579", name: "Ritu Sinha", mobile: "+91 98900 66772", email: "ritu.s@gmail.com", requirement: "Buy • 2–3 BHK", budget: "₹ 90L – 1.4Cr", project: "Tata Housing", location: "Wagholi, Pune", agent: "Rakesh Y.", status: "Qualified", followUp: "Nov 06, 04:00 PM", source: "Referral", propertyType: "Residential", bhk: "2 – 3 BHK" },
];

export const leadKpis = [
  { label: "Total Leads", value: "3,248", delta: "+18%", icon: "users", primary: true },
  { label: "New Leads", value: "642", delta: "+24%", icon: "userPlus" },
  { label: "Qualified Leads", value: "1,286", delta: "+21%", icon: "check" },
  { label: "Site Visits", value: "412", delta: "+12%", icon: "calendar" },
  { label: "Bookings", value: "136", delta: "+28%", icon: "handshake" },
  { label: "Conversion Rate", value: "4.19%", delta: "+0.9%", icon: "chart" },
];

export const statusTabs = [
  { label: "All Leads", count: "3,248" }, { label: "New", count: "642" },
  { label: "Contacted", count: "418" }, { label: "Qualified", count: "1,286" },
  { label: "Site Visit", count: "212" }, { label: "Negotiation", count: "128" },
  { label: "Booked", count: "136" }, { label: "Lost", count: "426" },
];

export const dashboardKpis = [
  { label: "Total Leads", value: "3,248", delta: "+18%", icon: "users", primary: true },
  { label: "New Leads", value: "642", delta: "+24%", icon: "userPlus" },
  { label: "Qualified Leads", value: "1,286", delta: "+21%", icon: "check" },
  { label: "Site Visits", value: "412", delta: "+12%", icon: "calendar" },
  { label: "Bookings", value: "136", delta: "+28%", icon: "handshake" },
  { label: "Brokerage (Due)", value: "₹ 24.8 L", delta: "+28%", icon: "coins" },
  { label: "Brokerage (Received)", value: "₹ 18.6 L", delta: "+32%", icon: "coinsGreen" },
];

export const leadTrend = [
  { d: "Nov 1", n: 90, c: 10 }, { d: "Nov 5", n: 150, c: 45 }, { d: "Nov 10", n: 270, c: 95 },
  { d: "Nov 15", n: 200, c: 75 }, { d: "Nov 20", n: 280, c: 110 }, { d: "Nov 25", n: 330, c: 105 },
  { d: "Nov 30", n: 400, c: 195 },
];

export const leadSources = [
  { name: "Meta Ads", value: 38, color: "#0f7a6b" },
  { name: "Website", value: 24, color: "#e8a91f" },
  { name: "Referral", value: 12, color: "#3b6fe0" },
  { name: "WhatsApp", value: 10, color: "#9b6fe0" },
  { name: "Google Ads", value: 9, color: "#2e86de" },
  { name: "Others", value: 7, color: "#c3c9cf" },
];

export const pipeline = [
  { stage: "New Enquiry", count: 642 }, { stage: "Interested", count: 418 },
  { stage: "Site Visit", count: 212 }, { stage: "Negotiation", count: 128 },
  { stage: "Booking", count: 136 },
];

export const upcomingVisits = [
  { date: "Nov", day: "05", time: "11:00 AM", project: "Shriram Nayra, Pune", customer: "Rohit Sharma", status: "Scheduled" },
  { date: "Nov", day: "05", time: "02:30 PM", project: "Godrej Emerald, Pune", customer: "Neha Kapoor", status: "Scheduled" },
  { date: "Nov", day: "06", time: "10:00 AM", project: "L&T Seawoods, Navi Mumbai", customer: "Amit Kulkarni", status: "Confirmed" },
];

export const todaysFollowUps = [
  { initials: "RS", name: "Rohit Sharma", note: "Call & share project details", time: "10:30 AM" },
  { initials: "AK", name: "Amit Kulkarni", note: "Confirm site visit", time: "12:00 PM" },
  { initials: "NG", name: "Neha Gupta", note: "Discuss pricing & offers", time: "03:00 PM" },
];

export const topAgents = [
  { rank: 1, name: "Ankit Singh", bookings: 28, amount: "₹ 8.4 L" },
  { rank: 2, name: "Neha Kapoor", bookings: 22, amount: "₹ 6.9 L" },
  { rank: 3, name: "Rakesh Yadav", bookings: 18, amount: "₹ 5.1 L" },
];

export const monthlyCommission = [
  { m: "Jun", v: 1.2 }, { m: "Jul", v: 3.1 }, { m: "Aug", v: 4.2 },
  { m: "Sep", v: 5.6 }, { m: "Oct", v: 6.8 }, { m: "Nov", v: 9.0 },
];

export const developerBookings = [
  { name: "Godrej Properties", bookings: 42, commission: "7.6 L" },
  { name: "L&T Realty", bookings: 28, commission: "5.2 L" },
  { name: "Shriram Properties", bookings: 24, commission: "4.1 L" },
  { name: "Tata Housing", bookings: 18, commission: "3.6 L" },
  { name: "Others", bookings: 24, commission: "4.3 L" },
];

export const recentLeads = [
  { name: "Vikas More", req: "Buy • 2–3 BHK • Pune", status: "New" as LeadStatus, ago: "2 min ago" },
  { name: "Pooja Desai", req: "Buy • 3 BHK • Navi Mumbai", status: "Contacted" as LeadStatus, ago: "15 min ago" },
  { name: "Karan Patil", req: "Buy • 1–2 BHK • Pune", status: "Qualified" as LeadStatus, ago: "28 min ago" },
];

export const progressSteps = ["New", "Contacted", "Interested", "Qualified", "Site Visit", "Booking"];

export const customerProfile = {
  id: "C-10586",
  name: "Rohit Sharma",
  status: "Qualified" as LeadStatus,
  mobile: "+91 98765 43210",
  email: "rohit.sharma@gmail.com",
  location: "Pune, Maharashtra",
  priority: "A (High Priority)",
  age: "34 Years",
  occupation: "IT Professional",
  family: "Wife + 1 Child",
  agent: "Ankit Singh",
  createdOn: "Nov 02, 2026, 10:30 AM",
  source: "Meta Ads (Campaign: Pune_2BHK)",
  stats: [
    { value: "10", label: "Total Interactions", icon: "users" },
    { value: "2", label: "Site Visits", icon: "calendar" },
    { value: "1", label: "Deal / Booking", icon: "handshake" },
    { value: "₹ 1.60 L", label: "Expected Commission", icon: "coins" },
  ],
  requirement: [
    ["Requirement", "Buy"], ["Property Type", "Residential (Apartment)"],
    ["Preferred Location", "Undri, NIBM, Kondhwa (Pune)"], ["Budget Range", "₹ 70 L – ₹ 1.20 Cr"],
    ["Preferred BHK", "2 – 3 BHK"], ["Possession", "Within 2 Years"],
    ["Key Preferences", "Gated Community, Amenities, Good Connectivity"],
  ] as [string, string][],
  interestedProjects: [
    { name: "Shriram Nayra", developer: "Shriram Properties", location: "Undri, Pune", status: "Site Visited" },
    { name: "Godrej Emerald", developer: "Godrej Properties", location: "Hinjewadi, Pune", status: "Interested" },
    { name: "L&T Seawoods", developer: "L&T Realty", location: "Navi Mumbai", status: "Shortlisted" },
  ],
  deal: [
    ["Project", "Shriram Nayra"], ["Booking Date", "Nov 10, 2026"], ["Booking Value", "₹ 80,00,000"],
    ["Agreement Rate", "2.00%"], ["Expected Commission", "₹ 1,60,000"],
  ] as [string, string][],
  timeline: [
    { type: "call", title: "Follow-up Call", desc: "Discussed budget and preferred locations.", time: "Nov 04, 06:15 PM", by: "by Ankit Singh" },
    { type: "visit", title: "Site Visit Completed", desc: "Visited Shriram Nayra project. Customer liked the location.", time: "Nov 03, 01:30 PM", by: "by Ankit Singh" },
    { type: "doc", title: "Project Brochure Shared", desc: "Sent Shriram Nayra and Godrej Emerald details on WhatsApp.", time: "Nov 03, 11:20 AM", by: "" },
    { type: "call", title: "Initial Call", desc: "Requirement captured and budget discussed.", time: "Nov 02, 03:45 PM", by: "" },
    { type: "new", title: "Lead Created", desc: "Lead received from Meta Ads.", time: "Nov 02, 10:30 AM", by: "" },
  ],
  tabs: ["Overview", "Interactions (10)", "Site Visits (2)", "Deals & Bookings (1)", "Documents (4)", "Notes"],
};

export const leadDetailNote = {
  text: "Customer interested in 2–3 BHK, site visit confirmed for Nov 05.",
  meta: "Nov 03, 2026, 11:20 AM  •  Ankit Singh",
};
