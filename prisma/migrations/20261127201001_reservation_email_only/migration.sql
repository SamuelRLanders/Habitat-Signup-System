-- Reserved spots name their volunteer by email only.

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "firstName",
DROP COLUMN "lastName";
