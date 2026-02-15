import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('Cinema API')
    .setDescription('Documentação da API do Cinema')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log('-----------------------------------------------------------');
  console.log('  🚀 API iniciando...');
  console.log(`  🌐 Endpoint:      http://localhost:${port}`);
  console.log(`  📘 Swagger:       http://localhost:${port}/api/docs`);
  console.log('  🗄️  Postgres:      postgres:5432');
  console.log('  🧠 Redis:         redis:6379');
  console.log(
    '  🐇 RabbitMQ:      rabbitmq:5672 / painel: http://localhost:15672',
  );
  console.log('-----------------------------------------------------------');
}
bootstrap();
