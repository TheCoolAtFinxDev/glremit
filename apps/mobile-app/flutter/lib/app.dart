import 'package:flutter/material.dart';

class GoLinkRemitApp extends StatelessWidget {
  const GoLinkRemitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GoLink Remit',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const Scaffold(
        body: Center(
          child: Text('Welcome to GoLink Remit!'),
        ),
      ),
    );
  }
}
