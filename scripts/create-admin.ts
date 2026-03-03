import "dotenv/config";
import { storage } from "../server/storage";
import { hashPassword } from "../server/auth";

async function createAdminUser() {
  try {
    console.log("Checking for existing users...");
    const existingUsers = await storage.getAllUsers();

    if (existingUsers.length > 0) {
      console.log(`Found ${existingUsers.length} existing user(s). Admin bootstrap skipped.`);
      process.exit(0);
    }

    const ownerUsername = process.env.ADMIN_USERNAME || "admin";
    const ownerPassword = process.env.ADMIN_PASSWORD || "changeme123";
    const ownerEmail = "admin@ctf.local";

    console.log(`Creating bootstrap owner account: ${ownerUsername}`);
    await storage.createUser({
      username: ownerUsername,
      email: ownerEmail,
      password: await hashPassword(ownerPassword),
      role: "owner",
    });

    console.log(`✓ Bootstrap owner created successfully: ${ownerUsername}`);
    console.log(`✓ Email: ${ownerEmail}`);
    console.log(`✓ Password: ${ownerPassword}`);
    console.log("⚠ Make sure to save these credentials!");

    // Seed default categories if none exist
    const existingCategories = await storage.getAllCategories();
    if (existingCategories.length === 0) {
      const defaultCategories = [
        { name: "Web", color: "#3B82F6", icon: "globe", isDefault: true },
        { name: "Crypto", color: "#8B5CF6", icon: "lock", isDefault: true },
        { name: "Pwn", color: "#EF4444", icon: "terminal", isDefault: true },
        { name: "Reverse", color: "#F97316", icon: "cpu", isDefault: true },
        { name: "Forensics", color: "#22C55E", icon: "search", isDefault: true },
        { name: "Misc", color: "#EAB308", icon: "puzzle", isDefault: true },
        { name: "Network", color: "#06B6D4", icon: "network", isDefault: true },
        { name: "OSINT", color: "#EC4899", icon: "eye", isDefault: true },
      ];

      console.log("Seeding default challenge categories...");
      for (const cat of defaultCategories) {
        await storage.createCategory(cat);
      }
      console.log("✓ Default categories created successfully");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create admin user:", error);
    process.exit(1);
  }
}

createAdminUser();
