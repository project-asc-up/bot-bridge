import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient | null = null;

if (process.env.DATABASE_URL) {
  try {
    prismaInstance =
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaInstance;
    }
  } catch (error) {
    console.error("Failed to initialize PrismaClient:", error);
    prismaInstance = null;
  }
}

export const prisma = prismaInstance;
