import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Ram Kumar"
    }
  });
await prisma.appCategory.createMany({
  data: [
    { appName: "Chrome", category: "productive" },
    { appName: "VSCode", category: "productive" },
    { appName: "Terminal", category: "productive" },
    { appName: "YouTube", category: "distracting" },
    { appName: "Instagram", category: "distracting" }
  ],
  skipDuplicates: true
});
  console.log("Created user:", user);
}



main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
