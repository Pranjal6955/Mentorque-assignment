import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  const defaultPassword = await bcrypt.hash("password123", 12);

  // 1. Admin (1 Admin)
  const adminData = {
    id: uuidv4(),
    name: "System Admin",
    email: "admin@mentorque.com",
    password: defaultPassword,
    role: "ADMIN",
    timezone: "UTC",
    description: "Platform Administrator overseeing mentor & user availability, AI matching, and call scheduling.",
    tags: ["Management", "Admin", "Operations"],
  };

  await prisma.user.upsert({
    where: { email: adminData.email },
    update: {
      description: adminData.description,
      tags: adminData.tags,
    },
    create: adminData,
  });
  console.log("✅ Admin user created/updated:", adminData.email);

  // 2. 5 Mentors (matching prompt attributes: Tech/Non-tech, Big company, India/Ireland, Senior Developer, Good communication)
  const mentors = [
    {
      name: "Dr. Aris Thorne",
      email: "aris.thorne@mentorque.com",
      description: "Senior AI & Machine Learning Strategist at a Big Tech company in Ireland with 12+ years building enterprise neural systems.",
      tags: ["Tech", "Big company", "Ireland", "Senior Developer", "Good communication"],
    },
    {
      name: "Elena Rostova",
      email: "elena.rostova@mentorque.com",
      description: "Staff Frontend Architect at a Public company in India specializing in React and high-performance Web UI rendering.",
      tags: ["Tech", "Public company", "India", "Senior Developer", "Good communication"],
    },
    {
      name: "Marcus Vance",
      email: "marcus.vance@mentorque.com",
      description: "Principal Cloud Systems Engineer at Big Tech in Ireland with expertise in Kubernetes and Distributed Microservices.",
      tags: ["Tech", "Big company", "Ireland", "Senior Developer"],
    },
    {
      name: "Sophia Chen",
      email: "sophia.chen@mentorque.com",
      description: "Executive Product Leadership Coach in India known for outstanding communication skills and scaling non-tech product strategies.",
      tags: ["Non-tech", "Public company", "India", "Good communication"],
    },
    {
      name: "Devon Okafor",
      email: "devon.okafor@mentorque.com",
      description: "Senior Cybersecurity Specialist in Ireland with public company experience and strong technical communication.",
      tags: ["Tech", "Public company", "Ireland", "Senior Developer", "Good communication"],
    },
  ];

  // Default standard week template slots (Mon-Fri 09:00 - 17:00)
  const defaultSlots = [];
  for (let day = 1; day <= 5; day++) {
    for (let hour = 9; hour < 17; hour++) {
      defaultSlots.push({ dayOfWeek: day, hour, enabled: true });
    }
  }

  for (const m of mentors) {
    const mentorUser = await prisma.user.upsert({
      where: { email: m.email },
      update: {
        name: m.name,
        description: m.description,
        tags: m.tags,
      },
      create: {
        id: uuidv4(),
        name: m.name,
        email: m.email,
        password: defaultPassword,
        role: "MENTOR",
        timezone: "UTC",
        description: m.description,
        tags: m.tags,
      },
    });

    // Create default availability template for mentor
    await prisma.availabilityTemplate.upsert({
      where: { mentorId: mentorUser.id },
      update: { slots: defaultSlots },
      create: {
        id: uuidv4(),
        mentorId: mentorUser.id,
        role: "MENTOR",
        slots: defaultSlots,
      },
    });
  }
  console.log("✅ 5 Mentors created/updated with default availability templates.");

  // 3. 10 Users (matching prompt attributes: Tech/Non-tech, Good communication, Asks a lot of questions)
  const users = [
    {
      name: "Alice Smith",
      email: "alice.smith@example.com",
      description: "Junior Full Stack Developer looking for resume revamp and tech interview preparation.",
      tags: ["Tech", "Asks a lot of questions"],
    },
    {
      name: "Bob Johnson",
      email: "bob.johnson@example.com",
      description: "Computer Science student preparing for tech mock interviews with senior big tech mentors.",
      tags: ["Tech", "Good communication"],
    },
    {
      name: "Carol White",
      email: "carol.white@example.com",
      description: "Non-tech project manager transitioning to tech product roles, seeking job market guidance.",
      tags: ["Non-tech", "Good communication", "Asks a lot of questions"],
    },
    {
      name: "David Miller",
      email: "david.miller@example.com",
      description: "Backend engineer focused on cloud native architectures & resume review for big tech applications.",
      tags: ["Tech", "Asks a lot of questions"],
    },
    {
      name: "Eva Green",
      email: "eva.green@example.com",
      description: "Data Analyst seeking job market guidance and resume polishing for senior roles.",
      tags: ["Tech", "Good communication"],
    },
    {
      name: "Frank Wright",
      email: "frank.wright@example.com",
      description: "Non-tech startup founder preparing for investor pitch communication and product guidance.",
      tags: ["Non-tech", "Asks a lot of questions"],
    },
    {
      name: "Grace Taylor",
      email: "grace.taylor@example.com",
      description: "Cybersecurity intern looking for mock interview practice with domain experts.",
      tags: ["Tech", "Good communication"],
    },
    {
      name: "Hank Adams",
      email: "hank.adams@example.com",
      description: "DevOps aspirant seeking resume revamp for public company job applications.",
      tags: ["Tech", "Asks a lot of questions"],
    },
    {
      name: "Ivy Patel",
      email: "ivy.patel@example.com",
      description: "Product Operations Lead seeking job market guidance in non-tech strategy.",
      tags: ["Non-tech", "Good communication"],
    },
    {
      name: "Jack Robinson",
      email: "jack.robinson@example.com",
      description: "Self-taught developer building portfolio applications and preparing for technical mock interviews.",
      tags: ["Tech", "Asks a lot of questions"],
    },
  ];

  for (const u of users) {
    const userUser = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        description: u.description,
        tags: u.tags,
      },
      create: {
        id: uuidv4(),
        name: u.name,
        email: u.email,
        password: defaultPassword,
        role: "USER",
        timezone: "UTC",
        description: u.description,
        tags: u.tags,
      },
    });

    // Create default availability template for user
    await prisma.availabilityTemplate.upsert({
      where: { userId: userUser.id },
      update: { slots: defaultSlots },
      create: {
        id: uuidv4(),
        userId: userUser.id,
        role: "USER",
        slots: defaultSlots,
      },
    });
  }
  console.log("✅ 10 Users created/updated with default availability templates.");

  console.log("✨ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
