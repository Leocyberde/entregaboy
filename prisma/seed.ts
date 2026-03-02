import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de usuários...');

  // 1. Criar Admin se não existir
  const adminExists = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@entregaboy.com.br',
        role: 'admin',
        passwordHash: 'admin123',
        isApproved: true,
      },
    });
    console.log('✅ Usuário Admin criado.');
  } else {
    console.log('ℹ️ Usuário Admin já existe.');
  }

  // 2. Criar Cliente se não existir
  const clienteExists = await prisma.user.findFirst({ where: { role: 'cliente' } });
  if (!clienteExists) {
    await prisma.user.create({
      data: {
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        role: 'cliente',
        passwordHash: 'cliente123',
        isApproved: true,
      },
    });
    console.log('✅ Usuário Cliente criado.');
  } else {
    console.log('ℹ️ Usuário Cliente já existe.');
  }

  // 3. Criar Motoboy se não existir
  const motoboyExists = await prisma.user.findFirst({ where: { role: 'motoboy' } });
  if (!motoboyExists) {
    await prisma.user.create({
      data: {
        name: 'Motoboy Teste',
        email: 'motoboy@teste.com',
        role: 'motoboy',
        passwordHash: 'motoboy123',
        isApproved: true,
        isOnline: true,
        vehiclePlate: 'ABC-1234',
        vehicleModel: 'Honda CG 160',
      },
    });
    console.log('✅ Usuário Motoboy criado.');
  } else {
    console.log('ℹ️ Usuário Motoboy já existe.');
  }

  console.log('🚀 Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
