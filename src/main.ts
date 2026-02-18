import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false, // Silencia TODOS os logs internos do NestJS
  });
  // CORS
  app.enableCors({
    origin: '*', // em produção especificar domínios permitidos
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  // Validação global (importante pros DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Cinema API')
    .setDescription(
      'Sistema de venda de ingressos com controle de concorrência',
    )
    .setVersion('1.0')
    .addTag('health', 'Health check')
    .addTag('sessions', 'Gestão de sessões de cinema')
    .addTag('seats', 'Disponibilidade de assentos')
    .addTag('reservations', 'Reservas temporárias')
    .addTag('payments', 'Confirmação de pagamento')
    .addTag('sales', 'Histórico de vendas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // OSC 8 — link clicável em terminais compatíveis (iTerm2, Warp, GNOME Terminal, Windows Terminal...)
  const link = (url: string) =>
    `\x1b]8;;${url}\x07\x1b[1;96;4m${url}\x1b[0m\x1b]8;;\x07`;

  const apiUrl = `http://localhost:${port}`;
  const swaggerUrl = `http://localhost:${port}/api/docs`;
  const rabbitUrl = `http://localhost:15672`;
  const prismaUrl = `http://localhost:5555`;

  const banner = `
\x1b[34m
  ░█████╗░██╗███╗░░██╗███████╗███╗░░░███╗░█████╗░
  ██╔══██╗██║████╗░██║██╔════╝████╗░████║██╔══██╗
  ██║░░╚═╝██║██╔██╗██║█████╗░░██╔████╔██║███████║
  ██║░░██╗██║██║╚████║██╔══╝░░██║╚██╔╝██║██╔══██║
  ╚█████╔╝██║██║░╚███║███████╗██║░╚═╝░██║██║░░██║
  ░╚════╝░╚═╝╚═╝░░╚══╝╚══════╝╚═╝░░░░╚═╝╚═╝░░╚═╝
\x1b[0m
  \x1b[1m🎬 Cineasy Ticket API\x1b[0m  \x1b[2mv1.0.0\x1b[0m

  \x1b[2m┌─ Endpoints ──────────────────────────────────────────────────┐\x1b[0m
  \x1b[2m│\x1b[0m  \x1b[35m◈\x1b[0m  API            ${link(apiUrl)}
  \x1b[2m│\x1b[0m  \x1b[35m◈\x1b[0m  Swagger        ${link(swaggerUrl)}
  \x1b[2m│\x1b[0m  \x1b[35m◈\x1b[0m  RabbitMQ UI    ${link(rabbitUrl)}
  \x1b[2m│\x1b[0m  \x1b[35m◈\x1b[0m  PrismaStudio   ${link(prismaUrl)}
  \x1b[2m└──────────────────────────────────────────────────────────────┘\x1b[0m

  \x1b[2m┌─ Infraestrutura ─────────────────────────────────────────────┐\x1b[0m
  \x1b[2m│\x1b[0m  \x1b[2m●\x1b[0m  PostgreSQL     \x1b[2mpostgres:5432\x1b[0m
  \x1b[2m│\x1b[0m  \x1b[2m●\x1b[0m  Redis          \x1b[2mredis:6379\x1b[0m
  \x1b[2m│\x1b[0m  \x1b[2m●\x1b[0m  RabbitMQ       \x1b[2mrabbitmq:5672\x1b[0m
  \x1b[2m│\x1b[0m  \x1b[2m●\x1b[0m  Prisma Studio  \x1b[2mlocalhost:5555\x1b[0m
  \x1b[2m└──────────────────────────────────────────────────────────────┘\x1b[0m
`;
  console.log(banner);
}
bootstrap();
