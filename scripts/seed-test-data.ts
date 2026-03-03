import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema";
import { hashPassword } from "../server/auth";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Test data generators
const categories = [
  { name: "Web", color: "#10B981", icon: "globe" },
  { name: "Crypto", color: "#8B5CF6", icon: "lock" },
  { name: "Pwn", color: "#EF4444", icon: "terminal" },
  { name: "Reverse", color: "#3B82F6", icon: "cpu" },
  { name: "Forensics", color: "#F59E0B", icon: "search" },
  { name: "Network", color: "#06B6D4", icon: "network" },
  { name: "Misc", color: "#EC4899", icon: "puzzle" },
];

const users = [
  { username: "hacker1", email: "hacker1@example.com", password: "password123" },
  { username: "cyberwarrior", email: "cyber@example.com", password: "password123" },
  { username: "l33tc0d3r", email: "l33t@example.com", password: "password123" },
  { username: "anonymouse", email: "anon@example.com", password: "password123" },
  { username: "bugbounty", email: "bounty@example.com", password: "password123" },
  { username: "shellshock", email: "shell@example.com", password: "password123" },
  { username: "cryptoking", email: "crypto@example.com", password: "password123" },
  { username: "forensicpro", email: "forensic@example.com", password: "password123" },
  { username: "revmaster", email: "revmaster@example.com", password: "password123" },
  { username: "webwizard", email: "webwiz@example.com", password: "password123" },
  { username: "pwnstar", email: "pwn@example.com", password: "password123" },
  { username: "hacktheplanet", email: "hackplanet@example.com", password: "password123" },
];

const teams = [
  { name: "Elite Hackers", captain: "hacker1" },
  { name: "Cyber Warriors", captain: "cyberwarrior" },
  { name: "Code Breakers", captain: "l33tc0d3r" },
];

const challengeTemplates = {
  Web: [
    { name: "SQL Injection 101", description: "Find the flag hidden in the database using SQL injection.\n\nURL: http://challenge.example.com/sqli\n\nHint: Try ' OR '1'='1", points: 100, flag: "flag{sql_1nj3ct10n_m4st3r}" },
    { name: "XSS Challenge", description: "Exploit the XSS vulnerability to steal the admin cookie.\n\nURL: http://challenge.example.com/xss", points: 150, flag: "flag{xss_c00k13_st34l3r}" },
    { name: "CSRF Attack", description: "Perform a CSRF attack to change the admin password.\n\nURL: http://challenge.example.com/csrf", points: 200, flag: "flag{csrf_pwn3d_4dm1n}" },
    { name: "LFI Exploitation", description: "Use Local File Inclusion to read /etc/passwd.\n\nURL: http://challenge.example.com/lfi", points: 175, flag: "flag{lf1_r34d_s3cr3ts}" },
    { name: "API Security", description: "Find the hidden API endpoint and exploit it.\n\nURL: http://challenge.example.com/api", points: 225, flag: "flag{4p1_s3cur1ty_f41l}" },
    { name: "JWT Cracking", description: "Crack the weak JWT secret and forge an admin token.\n\nToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", points: 250, flag: "flag{jwt_s3cr3t_cr4ck3d}" },
  ],
  Crypto: [
    { name: "Caesar Cipher", description: "Decrypt the message: Synt{p13s4e_p1cy3e_1f_34fl}\n\nROT13 was used.", points: 50, flag: "flag{c13s4r_c1ph3r_1s_34sy}" },
    { name: "RSA Weak Keys", description: "Factor the weak RSA modulus:\nn = 8927\ne = 5\nc = 5859", points: 200, flag: "flag{rs4_w34k_k3ys_pwn3d}" },
    { name: "AES ECB Mode", description: "Exploit ECB mode to decrypt the flag.\n\nCiphertext: 68656c6c6f776f726c64...", points: 175, flag: "flag{3cb_m0d3_1s_b4d}" },
    { name: "Hash Collision", description: "Find a hash collision for MD5.\n\nTarget hash: 098f6bcd4621d373cade4e832627b4f6", points: 225, flag: "flag{h4sh_c0ll1s10n_f0und}" },
    { name: "One-Time Pad Reuse", description: "Exploit OTP key reuse to decrypt both messages.", points: 250, flag: "flag{0tp_r3us3_1s_f4t4l}" },
    { name: "Vigenere Cipher", description: "Break the Vigenere cipher with key length 5.", points: 150, flag: "flag{v1g3n3r3_cr4ck3d}" },
  ],
  Pwn: [
    { name: "Buffer Overflow", description: "Overflow the buffer and overwrite the return address.\n\nConnect: nc challenge.example.com 1337", points: 200, flag: "flag{buff3r_0v3rfl0w_pwn}" },
    { name: "Format String", description: "Exploit format string vulnerability to leak the flag.\n\nConnect: nc challenge.example.com 1338", points: 225, flag: "flag{f0rm4t_str1ng_l34k}" },
    { name: "ROP Chain", description: "Build a ROP chain to get shell access.\n\nConnect: nc challenge.example.com 1339", points: 300, flag: "flag{r0p_ch41n_m4st3r}" },
    { name: "Heap Overflow", description: "Exploit heap overflow to gain code execution.\n\nConnect: nc challenge.example.com 1340", points: 275, flag: "flag{h34p_0v3rfl0w_pwn3d}" },
    { name: "Use After Free", description: "Exploit UAF vulnerability to control program flow.\n\nConnect: nc challenge.example.com 1341", points: 250, flag: "flag{us3_4ft3r_fr33_pwn}" },
    { name: "Stack Canary Bypass", description: "Bypass stack canaries to exploit the binary.", points: 325, flag: "flag{c4n4ry_byp4ss3d}" },
  ],
  Reverse: [
    { name: "Basic Reversing", description: "Reverse engineer this binary to find the flag.\n\nDownload: reverse_me", points: 100, flag: "flag{r3v3rs3_3ng1n33r1ng}" },
    { name: "Stripped Binary", description: "Find the flag in this stripped binary.", points: 175, flag: "flag{str1pp3d_b1n4ry_pwn3d}" },
    { name: "Anti-Debug", description: "Bypass anti-debugging techniques to get the flag.", points: 225, flag: "flag{4nt1_d3bug_byp4ss3d}" },
    { name: "Obfuscated Code", description: "Deobfuscate the code to reveal the flag.", points: 200, flag: "flag{d30bfusc4t3d_c0d3}" },
    { name: "VM Reversing", description: "Reverse engineer this custom VM to find the flag.", points: 300, flag: "flag{vm_r3v3rs3d_h4rd}" },
    { name: "Malware Analysis", description: "Analyze this malware sample (safe) to extract the C2 domain.", points: 250, flag: "flag{m4lw4r3_4n4lys1s_d0n3}" },
  ],
  Forensics: [
    { name: "Image Steganography", description: "Extract the hidden message from this image.\n\nDownload: secret.png", points: 100, flag: "flag{st3g4n0gr4phy_f0und}" },
    { name: "PCAP Analysis", description: "Analyze the network capture to find the exfiltrated data.\n\nDownload: capture.pcap", points: 175, flag: "flag{pc4p_4n4lys1s_pwn3d}" },
    { name: "Memory Forensics", description: "Analyze the memory dump to find the password.\n\nDownload: memory.raw", points: 250, flag: "flag{m3m0ry_f0r3ns1cs_m4st3r}" },
    { name: "Disk Forensics", description: "Recover deleted files from this disk image.", points: 200, flag: "flag{d1sk_f0r3ns1cs_r3c0v3r3d}" },
    { name: "Log Analysis", description: "Find the attacker's IP in these server logs.", points: 150, flag: "flag{l0g_4n4lys1s_f0und}" },
    { name: "File Carving", description: "Carve files from this corrupted filesystem.", points: 225, flag: "flag{f1l3_c4rv1ng_succ3ss}" },
  ],
  Network: [
    { name: "Packet Sniffing", description: "Analyze the captured traffic to find credentials sent in plaintext.\n\nDownload: traffic.pcap", points: 100, flag: "flag{pl41nt3xt_cr3ds_l34k3d}" },
    { name: "DNS Exfiltration", description: "Detect and decode the data exfiltrated via DNS queries.\n\nDownload: dns_capture.pcap", points: 200, flag: "flag{dns_3xf1l_d3t3ct3d}" },
    { name: "ARP Spoofing", description: "Identify the attacker performing ARP spoofing on the network.\n\nDownload: arp_capture.pcap", points: 175, flag: "flag{4rp_sp00f_c4ught}" },
    { name: "Firewall Bypass", description: "Find a way to bypass the firewall rules and reach the hidden service.\n\nTarget: 10.0.0.5:8080", points: 250, flag: "flag{f1r3w4ll_byp4ss3d}" },
    { name: "VLAN Hopping", description: "Escape the restricted VLAN to access the management network.", points: 225, flag: "flag{vl4n_h0pp1ng_succ3ss}" },
    { name: "Wi-Fi Cracking", description: "Crack the WPA2 handshake to find the network password.\n\nDownload: handshake.cap", points: 200, flag: "flag{w1f1_cr4ck3d_wpa2}" },
  ],
  Misc: [
    { name: "OSINT Challenge", description: "Find information about user @mysteryhacker on social media.", points: 100, flag: "flag{0s1nt_m4st3r_pwn3d}" },
    { name: "QR Code Hunt", description: "Scan all QR codes to piece together the flag.", points: 125, flag: "flag{qr_c0d3_hunt_c0mpl3t3}" },
    { name: "Trivia Master", description: "Answer all cybersecurity trivia questions correctly.", points: 75, flag: "flag{tr1v14_m4st3r_w1nn3r}" },
    { name: "Git Secrets", description: "Find secrets committed to this Git repository.\n\nRepo: https://github.com/example/ctf-challenge", points: 150, flag: "flag{g1t_s3cr3ts_f0und}" },
    { name: "Blockchain Analysis", description: "Trace the cryptocurrency transactions to find the flag.", points: 200, flag: "flag{bl0ckch41n_tr4c3d}" },
    { name: "Social Engineering", description: "Use social engineering techniques to get the admin's password.", points: 175, flag: "flag{s0c14l_3ng1n33r1ng_pwn3d}" },
  ],
};

async function main() {
  console.log("🚀 Starting test data seeding...\n");

  // Create categories
  console.log("📁 Creating categories...");
  const createdCategories = [];
  for (const cat of categories) {
    const [category] = await db
      .insert(schema.categories)
      .values(cat)
      .onConflictDoNothing()
      .returning();
    if (category) {
      createdCategories.push(category);
      console.log(`  ✓ Created category: ${cat.name}`);
    }
  }

  // Get all categories (including existing)
  const allCategories = await db.select().from(schema.categories);
  console.log(`✓ ${allCategories.length} categories ready\n`);

  // Create users
  console.log("👥 Creating users...");
  const createdUsers = [];
  for (const user of users) {
    const hashedPassword = await hashPassword(user.password);
    const [createdUser] = await db
      .insert(schema.users)
      .values({
        username: user.username,
        email: user.email,
        password: hashedPassword,
        role: "user",
      })
      .onConflictDoNothing()
      .returning();
    if (createdUser) {
      createdUsers.push(createdUser);
      console.log(`  ✓ Created user: ${user.username}`);
    }
  }
  console.log(`✓ ${createdUsers.length} users created\n`);

  // Get all users
  const allUsers = await db.select().from(schema.users);

  // Create teams
  console.log("🏆 Creating teams...");
  const createdTeams = [];

  // Helper function to generate unique invite code
  function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  for (const team of teams) {
    const captain = allUsers.find((u) => u.username === team.captain);
    if (captain) {
      const [createdTeam] = await db
        .insert(schema.teams)
        .values({
          name: team.name,
          captainId: captain.id,
          inviteCode: generateInviteCode(),
        })
        .onConflictDoNothing()
        .returning();
      if (createdTeam) {
        createdTeams.push(createdTeam);
        console.log(`  ✓ Created team: ${team.name} (Captain: ${team.captain})`);

        // Add captain as team member
        await db.insert(schema.teamMembers).values({
          userId: captain.id,
          teamId: createdTeam.id,
        }).onConflictDoNothing();
      }
    }
  }

  // Add other users to teams
  const teamlessUsers = allUsers.filter(
    (u) => !teams.some((t) => t.captain === u.username)
  );
  for (let i = 0; i < teamlessUsers.length && i < createdTeams.length; i++) {
    const user = teamlessUsers[i];
    const team = createdTeams[i % createdTeams.length];
    await db.insert(schema.teamMembers).values({
      userId: user.id,
      teamId: team.id,
    }).onConflictDoNothing();
    console.log(`  ✓ Added ${user.username} to ${team.name}`);
  }
  console.log(`✓ ${createdTeams.length} teams created\n`);

  // Create CTF events for 2026
  console.log("🎯 Creating CTF events for 2026...");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const ctfEvents = [];
  for (let month = 0; month < 12; month++) {
    const startDate = new Date(2026, month, 5, 0, 0, 0);
    const endDate = new Date(2026, month + 1, 0, 23, 59, 59); // Last day of month

    const [ctfEvent] = await db
      .insert(schema.ctfEvents)
      .values({
        name: `${months[month]} 2026 CTF`,
        description: `Monthly CTF competition for ${months[month]} 2026. Test your skills across multiple categories!`,
        startTime: startDate,
        endTime: endDate,
        isTeamBased: month % 2 === 0, // Alternate between team and individual
        maxTeamSize: 4,
        isPublished: true,
        scoreboardFrozen: false,
      })
      .returning();

    ctfEvents.push(ctfEvent);
    console.log(`  ✓ Created CTF: ${months[month]} 2026 (${ctfEvent.isTeamBased ? 'Team' : 'Individual'})`);
  }
  console.log(`✓ ${ctfEvents.length} CTF events created\n`);

  // Create challenges for each CTF
  console.log("🎮 Creating challenges...");
  let totalChallenges = 0;

  for (const ctfEvent of ctfEvents) {
    console.log(`\n  Creating challenges for ${ctfEvent.name}...`);

    for (const category of allCategories) {
      const templates = challengeTemplates[category.name as keyof typeof challengeTemplates] || [];

      for (const template of templates) {
        const [challenge] = await db
          .insert(schema.challenges)
          .values({
            name: template.name,
            description: template.description,
            categoryId: category.id,
            ctfEventId: ctfEvent.id,
            points: template.points,
            flag: template.flag,
            isDynamic: false,
            solveCount: 0,
          })
          .returning();

        totalChallenges++;
        console.log(`    ✓ ${category.name}: ${template.name} (${template.points}pts)`);
      }
    }
  }
  console.log(`\n✓ ${totalChallenges} challenges created\n`);

  // Add some solves to the current active CTF
  console.log("🏁 Adding solves to active CTF...");
  const now = new Date();
  const activeCtf = ctfEvents.find(
    (ctf) => ctf.startTime <= now && ctf.endTime >= now
  );

  if (activeCtf) {
    console.log(`  Active CTF: ${activeCtf.name}`);

    // Get challenges for active CTF
    const activeChallenges = await db
      .select()
      .from(schema.challenges)
      .where(schema.eq(schema.challenges.ctfEventId, activeCtf.id));

    // Random solves
    let solveCount = 0;
    for (const challenge of activeChallenges.slice(0, 15)) {
      // Solve first 15 challenges
      const solverCount = Math.floor(Math.random() * 5) + 1; // 1-5 solvers
      const shuffledUsers = [...allUsers].sort(() => Math.random() - 0.5);

      for (let i = 0; i < solverCount && i < shuffledUsers.length; i++) {
        const user = shuffledUsers[i];
        const teamId = activeCtf.isTeamBased
          ? (await db.select().from(schema.teamMembers).where(schema.eq(schema.teamMembers.userId, user.id)))[0]?.teamId
          : null;

        const solveTime = new Date(
          activeCtf.startTime.getTime() +
          Math.random() * (now.getTime() - activeCtf.startTime.getTime())
        );

        await db
          .insert(schema.solves)
          .values({
            challengeId: challenge.id,
            userId: user.id,
            teamId,
            ctfEventId: activeCtf.id,
            points: challenge.points,
            isFirstBlood: i === 0,
            solvedAt: solveTime,
          })
          .onConflictDoNothing();

        solveCount++;
      }

      // Update solve count
      await db
        .update(schema.challenges)
        .set({ solveCount: solverCount })
        .where(schema.eq(schema.challenges.id, challenge.id));

      console.log(`    ✓ ${challenge.name}: ${solverCount} solves`);
    }
    console.log(`  ✓ ${solveCount} total solves added\n`);
  } else {
    console.log("  ⚠ No active CTF found (all CTFs are in 2026)\n");
  }

  console.log("✅ Test data seeding complete!\n");
  console.log("📊 Summary:");
  console.log(`  - ${allCategories.length} categories`);
  console.log(`  - ${allUsers.length} users`);
  console.log(`  - ${createdTeams.length} teams`);
  console.log(`  - ${ctfEvents.length} CTF events`);
  console.log(`  - ${totalChallenges} challenges`);
  console.log("\n🎉 Ready for testing!");

  await pool.end();
}

main().catch((error) => {
  console.error("❌ Error seeding data:", error);
  process.exit(1);
});
